import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedResponse {
  question_id: string;
  is_attempted: boolean;
  claimed_option_ids?: string[];
  claimed_numeric_value?: number | null;
   // Optional extended data for question analysis
   question_text?: string;
   options?: { id: string; label: string; text: string }[];
}

interface AnswerKeyItem {
  question_id: string;
  subject: string;
  question_type: string;
  correct_option_ids: string[] | null;
  correct_numeric_value: number | null;
  numeric_tolerance: number;
  is_cancelled: boolean;
  is_bonus: boolean;
}

interface MarkingRules {
  [key: string]: {
    correct: number;
    wrong: number;
    unattempted: number;
  };
}

 interface QuestionResult {
   question_id: string;
   qno: number;
   subject: string;
   section: "A" | "B";
   attempted: boolean;
   is_correct: boolean;
   marks_awarded: number;
   negative: number;
   user_answer: string | number | null;
   correct_answer: string | number | null;
   question_text: string;
   options: { id: string; label: string; text: string }[];
 }
 
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { testId, parsedResponses, sourceType } = await req.json();

    if (!testId || !parsedResponses || !Array.isArray(parsedResponses)) {
      console.error("Missing required fields:", { testId, hasResponses: !!parsedResponses });
      return new Response(
        JSON.stringify({ success: false, error: "Missing testId or parsedResponses" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing submission for test ${testId} with ${parsedResponses.length} responses`);

    // Create Supabase client with service role key (can read answer_keys)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get test and marking rules
    const { data: test, error: testError } = await supabase
      .from("tests")
      .select("id, marking_rules_json")
      .eq("id", testId)
      .single();

    if (testError || !test) {
      console.error("Test not found:", testError);
      return new Response(
        JSON.stringify({ success: false, error: "Test not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get answer keys (service role bypasses RLS)
    const { data: answerKeys, error: akError } = await supabase
      .from("answer_keys")
      .select("question_id, subject, question_type, correct_option_ids, correct_numeric_value, numeric_tolerance, is_cancelled, is_bonus")
      .eq("test_id", testId);

    if (akError || !answerKeys || answerKeys.length === 0) {
      console.error("Answer keys not found:", akError);
      return new Response(
        JSON.stringify({ success: false, error: "Answer keys not found for this test" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${answerKeys.length} answer keys for test ${testId}`);

    // Get user ID from auth header if available
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Generate a secure share token
    const shareToken = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Calculate scores
    const markingRules = test.marking_rules_json as MarkingRules;
    const scoringResult = calculateScores(parsedResponses, answerKeys as AnswerKeyItem[], markingRules, "temp");
 
    // Create submission with share token and question results
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        test_id: testId,
        source_type: sourceType || "url",
        share_enabled: true,
        share_token: shareToken,
        user_id: userId,
        question_results_json: scoringResult.questionResults,
        ...scoringResult.summary,
      })
      .select()
      .single();
 
    if (subError || !submission) {
      console.error("Failed to create submission:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create submission" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
 
    console.log(`Created submission ${submission.id} with share token`);

    // Insert responses
    const responsesWithSubmissionId = scoringResult.responses.map(r => ({
      ...r,
      submission_id: submission.id,
    }));
    
    if (responsesWithSubmissionId.length > 0) {
      const { error: respError } = await supabase
        .from("responses")
        .insert(responsesWithSubmissionId);

      if (respError) {
        console.error("Error inserting responses:", respError);
      }
    }

    console.log(`Scoring complete: ${scoringResult.summary.total_marks}/300`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        submissionId: submission.id,
      summary: scoringResult.summary,
      shareToken: shareToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Edge function error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Scoring logic (duplicated here since we can't import from src)
function calculateScores(
  parsedResponses: ParsedResponse[],
  answerKeys: AnswerKeyItem[],
  markingRules: MarkingRules,
  submissionId: string
) {
  const responses: any[] = [];
  const questionResults: QuestionResult[] = [];
  
  let totalMarks = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let negativeMarks = 0;

  const subjectScores: Record<string, { marks: number; attempted: number; correct: number; wrong: number; unattempted: number }> = {
    Mathematics: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
    Physics: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
    Chemistry: { marks: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
  };

  // Create a map for quick answer key lookup
  const answerKeyMap = new Map<string, AnswerKeyItem>();
  answerKeys.forEach((key) => {
    answerKeyMap.set(String(key.question_id), key);
  });

  // Create a map for parsed responses with extended data
  const parsedMap = new Map<string, ParsedResponse>();
  parsedResponses.forEach((r) => {
    parsedMap.set(String(r.question_id), r);
  });
 
  // Track question number for ordering
  let qno = 0;
 
  // Process each parsed response
  parsedResponses.forEach((parsed) => {
    const questionId = String(parsed.question_id);
    const answerKey = answerKeyMap.get(questionId);
    
    if (!answerKey) return;

    qno++;
    const subject = answerKey.subject;
    const questionType = answerKey.question_type;
    const rules = markingRules[questionType] || { correct: 4, wrong: -1, unattempted: 0 };
    const isNumerical = questionType === "numerical";
    const section: "A" | "B" = isNumerical ? "B" : "A";

    let status: "correct" | "wrong" | "unattempted" | "cancelled" = "unattempted";
    let marksAwarded = 0;
    let negative = 0;

    if (answerKey.is_cancelled) {
      status = "cancelled";
      marksAwarded = 0;
    } else if (answerKey.is_bonus) {
      if (parsed.is_attempted) {
        const isCorrect = checkAnswer(parsed, answerKey);
        if (isCorrect) {
          status = "correct";
          marksAwarded = rules.correct;
        } else {
          status = "wrong";
          marksAwarded = 0;
        }
      } else {
        status = "correct";
        marksAwarded = rules.correct;
      }
    } else if (!parsed.is_attempted) {
      status = "unattempted";
      marksAwarded = rules.unattempted;
      totalUnattempted++;
      if (subjectScores[subject]) subjectScores[subject].unattempted++;
    } else {
      totalAttempted++;
      if (subjectScores[subject]) subjectScores[subject].attempted++;
      
      const isCorrect = checkAnswer(parsed, answerKey);
      
      if (isCorrect) {
        status = "correct";
        marksAwarded = rules.correct;
        totalCorrect++;
        if (subjectScores[subject]) subjectScores[subject].correct++;
      } else {
        status = "wrong";
        if (questionType === "numerical") {
          marksAwarded = 0;
        } else {
          marksAwarded = rules.wrong;
          negative = Math.abs(rules.wrong);
          negativeMarks += negative;
        }
        totalWrong++;
        if (subjectScores[subject]) subjectScores[subject].wrong++;
      }
    }

    totalMarks += marksAwarded;
    if (subjectScores[subject]) subjectScores[subject].marks += marksAwarded;

    // Determine user answer for display
    let userAnswer: string | number | null = null;
    if (isNumerical) {
      userAnswer = parsed.claimed_numeric_value ?? null;
    } else if (parsed.claimed_option_ids && parsed.claimed_option_ids.length > 0) {
      userAnswer = parsed.claimed_option_ids[0];
    }
 
    // Determine correct answer for display
    let correctAnswer: string | number | null = null;
    if (isNumerical) {
      correctAnswer = answerKey.correct_numeric_value;
    } else if (answerKey.correct_option_ids && answerKey.correct_option_ids.length > 0) {
      correctAnswer = answerKey.correct_option_ids[0];
    }
 
    responses.push({
      question_id: questionId,
      claimed_option_ids: parsed.claimed_option_ids?.map(id => String(id)) || null,
      claimed_numeric_value: parsed.claimed_numeric_value ?? null,
      status,
      marks_awarded: marksAwarded,
      subject,
    });
 
    // Build question result for detailed analysis
    questionResults.push({
      question_id: questionId,
      qno,
      subject,
      section,
      attempted: parsed.is_attempted,
      is_correct: status === "correct",
      marks_awarded: marksAwarded,
      negative,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
      question_text: parsed.question_text || `Question ${qno}`,
      options: parsed.options || [],
    });
  });

  const accuracyPercentage = totalAttempted > 0 
    ? Math.round((totalCorrect / totalAttempted) * 100 * 100) / 100 
    : 0;

  return {
    responses,
    questionResults,
    summary: {
      total_marks: totalMarks,
      total_attempted: totalAttempted,
      total_correct: totalCorrect,
      total_wrong: totalWrong,
      total_unattempted: totalUnattempted,
      accuracy_percentage: accuracyPercentage,
      negative_marks: negativeMarks,
      math_marks: subjectScores.Mathematics.marks,
      physics_marks: subjectScores.Physics.marks,
      chemistry_marks: subjectScores.Chemistry.marks,
    },
  };
}

function checkAnswer(parsed: ParsedResponse, answerKey: AnswerKeyItem): boolean {
  if (answerKey.question_type === "numerical") {
    if (parsed.claimed_numeric_value === undefined || parsed.claimed_numeric_value === null) return false;
    if (answerKey.correct_numeric_value === null) return false;
    
    const tolerance = answerKey.numeric_tolerance || 0.01;
    const diff = Math.abs(parsed.claimed_numeric_value - answerKey.correct_numeric_value);
    return diff <= tolerance;
  }

  if (!parsed.claimed_option_ids || !answerKey.correct_option_ids) return false;
  if (parsed.claimed_option_ids.length === 0 || answerKey.correct_option_ids.length === 0) return false;

  const claimed = parsed.claimed_option_ids.map(id => String(id)).sort().join(",");
  const correct = answerKey.correct_option_ids.map(id => String(id)).sort().join(",");
  
  return claimed === correct;
}
