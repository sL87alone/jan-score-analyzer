 // Percentile estimation based on previous JEE Main data
 // This is a simplified interpolation for the static demo
 
 // Sample marks to percentile mapping (approximate)
 const PERCENTILE_TABLE: [number, number][] = [
   [300, 100.0],
   [280, 99.99],
   [260, 99.95],
   [240, 99.8],
   [220, 99.5],
   [200, 99.0],
   [180, 98.0],
   [160, 96.0],
   [140, 93.0],
   [120, 88.0],
   [100, 82.0],
   [80, 73.0],
   [60, 60.0],
   [40, 42.0],
   [20, 20.0],
   [0, 0.0],
 ];
 
 export function estimatePercentile(
   marks: number,
   _examDate: string,
   _shift: string
 ): string {
   // Clamp marks to valid range
   const clampedMarks = Math.max(-60, Math.min(300, marks));
 
   // Handle negative marks
   if (clampedMarks < 0) {
     return "< 1";
   }
 
   // Find interpolation points
   for (let i = 0; i < PERCENTILE_TABLE.length - 1; i++) {
     const [highMarks, highPercentile] = PERCENTILE_TABLE[i];
     const [lowMarks, lowPercentile] = PERCENTILE_TABLE[i + 1];
 
     if (clampedMarks >= lowMarks && clampedMarks <= highMarks) {
       // Linear interpolation
       const ratio = (clampedMarks - lowMarks) / (highMarks - lowMarks);
       const percentile = lowPercentile + ratio * (highPercentile - lowPercentile);
 
       // Format based on range
       if (percentile >= 99.9) {
         return percentile.toFixed(2);
       } else if (percentile >= 90) {
         return percentile.toFixed(1);
       } else {
         return Math.round(percentile).toString();
       }
     }
   }
 
   return "N/A";
 }