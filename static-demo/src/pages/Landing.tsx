 import { ArrowRight, ChevronDown, TrendingUp, LayoutGrid, Target, Upload, CalendarDays, BarChart3, Share2, Zap, Info } from "lucide-react";
 import { Button } from "../components/Button";
 import { Card, CardContent } from "../components/Card";
 import { Badge } from "../components/Badge";
 
 interface LandingProps {
   onNavigate: (route: "home" | "analyze" | "result") => void;
 }
 
 const featureBadges = [
   { icon: Target, label: "Marks + Accuracy" },
   { icon: LayoutGrid, label: "Section A/B Split" },
   { icon: TrendingUp, label: "Expected Percentile" },
 ];
 
 const features = [
   {
     icon: TrendingUp,
     title: "Expected Percentile",
     description: "Estimate your percentile using marks vs percentile trends from previous JEE Main sessions.",
   },
   {
     icon: LayoutGrid,
     title: "Section A vs Section B",
     description: "Instantly see MCQ vs Numerical performance — attempted, correct, wrong, and negatives.",
   },
   {
     icon: Share2,
     title: "Shareable Report",
     description: "Download your report or share it with friends.",
   },
 ];
 
 const steps = [
   {
     icon: Upload,
     number: "01",
     title: "Import response sheet",
     description: "Paste your JEE Main response sheet URL or upload the HTML file.",
   },
   {
     icon: CalendarDays,
     number: "02",
     title: "Select exam date + shift",
     description: "Choose your exam date and shift for accurate scoring.",
   },
   {
     icon: BarChart3,
     number: "03",
     title: "Get score + breakdown",
     description: "Marks, accuracy, negatives, Section A/B breakdown, and expected percentile.",
   },
 ];
 
 const faqs = [
   {
     question: "Is this official percentile?",
     answer: "No, this is an estimate based on previous JEE Main trends. Actual percentile depends on official NTA results.",
   },
   {
     question: "What is Section A / Section B?",
     answer: "Section A contains MCQ questions (+4 correct, -1 wrong). Section B contains Numerical questions (+4 correct, 0 wrong).",
   },
   {
     question: "How are negative marks calculated?",
     answer: "MCQ wrong = -1 mark. Numerical wrong = 0 marks (no negative). Unattempted = 0 marks.",
   },
 ];
 
 export function Landing({ onNavigate }: LandingProps) {
   return (
     <div className="min-h-screen">
       {/* Hero Section */}
       <section className="min-h-[90vh] flex flex-col items-center justify-center pt-16 px-4 hero-gradient">
         <div className="container mx-auto max-w-4xl text-center">
           <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-balance">
             Check your <span className="text-primary">JEE score</span> + expected percentile in 30 seconds.
           </h1>
 
           <div className="space-y-3 mb-8">
             <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
               Paste your JEE Main response-sheet link or upload the HTML file.
             </p>
             <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
               Get marks, accuracy, negative, section-wise (A/B) breakdown, and expected percentile.
             </p>
           </div>
 
           <div className="flex flex-wrap justify-center gap-3 mb-10">
             {featureBadges.map((badge, index) => (
               <Badge key={index} className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
                 <badge.icon className="w-4 h-4 mr-2" />
                 {badge.label}
               </Badge>
             ))}
           </div>
 
           <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
             <Button size="lg" className="glow-effect gap-2" onClick={() => onNavigate("analyze")}>
               Check My Score
               <ArrowRight className="w-5 h-5" />
             </Button>
             <a href="#how-it-works">
               <Button variant="outline" size="lg" className="gap-2">
                 How it works
                 <ChevronDown className="w-5 h-5" />
               </Button>
             </a>
           </div>
         </div>
       </section>
 
       {/* Features Section */}
       <section className="py-16 px-4">
         <div className="container mx-auto max-w-5xl">
           <div className="text-center mb-12">
             <h2 className="text-2xl md:text-3xl font-bold mb-3">What you'll get</h2>
             <p className="text-muted-foreground">Complete analysis in seconds</p>
           </div>
 
           <div className="grid md:grid-cols-3 gap-6">
             {features.map((feature) => (
               <Card key={feature.title} className="h-full hover:shadow-lg transition-shadow">
                 <CardContent>
                   <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                     <feature.icon className="w-6 h-6 text-primary" />
                   </div>
                   <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                   <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                 </CardContent>
               </Card>
             ))}
           </div>
         </div>
       </section>
 
       {/* Info Card */}
       <section className="py-12 px-4">
         <div className="container mx-auto max-w-4xl">
           <Card className="border-primary/20 bg-primary/5">
             <CardContent>
               <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                   <Info className="w-4 h-4 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg mb-1">Percentile Estimation</h3>
                   <p className="text-muted-foreground text-sm">
                     Percentile is estimated using previous JEE Main marks distribution. This is for reference only — actual results depend on NTA.
                   </p>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>
       </section>
 
       {/* How It Works Section */}
       <section id="how-it-works" className="py-24 px-4">
         <div className="container mx-auto max-w-5xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
             <p className="text-muted-foreground text-lg">Three simple steps to your score</p>
           </div>
 
           <div className="relative">
             <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />
 
             <div className="grid md:grid-cols-3 gap-8">
               {steps.map((step) => (
                 <div key={step.number} className="relative">
                   <Card className="relative z-10">
                     <CardContent>
                       <div className="flex items-center gap-4 mb-4">
                         <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shrink-0">
                           <step.icon className="w-7 h-7 text-primary-foreground" />
                         </div>
                         <span className="text-4xl font-bold text-muted-foreground/30 font-mono">{step.number}</span>
                       </div>
                       <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                       <p className="text-muted-foreground text-sm">{step.description}</p>
                     </CardContent>
                   </Card>
                 </div>
               ))}
             </div>
           </div>
         </div>
       </section>
 
       {/* FAQ Section */}
       <section className="py-16 px-4 bg-muted/30">
         <div className="container mx-auto max-w-3xl">
           <div className="text-center mb-10">
             <h2 className="text-2xl md:text-3xl font-bold mb-3">Frequently Asked Questions</h2>
             <p className="text-muted-foreground">Common questions about Jan Score Analyzer</p>
           </div>
 
           <div className="space-y-3">
             {faqs.map((faq, index) => (
               <Card key={index}>
                 <CardContent className="py-4">
                   <h4 className="font-medium mb-2">{faq.question}</h4>
                   <p className="text-muted-foreground text-sm">{faq.answer}</p>
                 </CardContent>
               </Card>
             ))}
           </div>
         </div>
       </section>
 
       {/* CTA Section */}
       <section className="py-20 px-4">
         <div className="container mx-auto max-w-3xl text-center">
           <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
             <Zap className="w-8 h-8 text-primary" />
           </div>
           <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to check your score?</h2>
           <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
             Get your complete analysis with expected percentile and section-wise breakdown.
           </p>
           <Button size="lg" className="glow-effect gap-2" onClick={() => onNavigate("analyze")}>
             Analyze Now
             <ArrowRight className="w-5 h-5" />
           </Button>
         </div>
       </section>
 
       {/* Footer */}
       <footer className="py-12 px-4 border-t bg-muted/30">
         <div className="container mx-auto max-w-5xl">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                 <Zap className="w-5 h-5 text-primary-foreground" />
               </div>
               <span className="font-bold text-lg">Jan Score Analyzer</span>
             </div>
           </div>
 
           <div className="mt-8 pt-8 border-t text-center">
             <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
               <strong>Disclaimer:</strong> This tool is for analysis only. Final score depends on official results released by NTA.
             </p>
             <p className="text-xs text-muted-foreground mt-4">
               © {new Date().getFullYear()} Jan Score Analyzer. All rights reserved.
             </p>
           </div>
         </div>
       </footer>
     </div>
   );
 }