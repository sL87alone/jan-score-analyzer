 import { useState, useEffect } from "react";
 import { Navbar } from "./components/Navbar";
 import { Landing } from "./pages/Landing";
 import { Analyzer } from "./pages/Analyzer";
 import { Result } from "./pages/Result";
 
 // Hash-based routing for GitHub Pages
 type Route = "home" | "analyze" | "result";
 
 function App() {
   const [route, setRoute] = useState<Route>("home");
   const [resultData, setResultData] = useState<ResultData | null>(null);
 
   useEffect(() => {
     const handleHashChange = () => {
       const hash = window.location.hash.slice(1) || "/";
       if (hash === "/" || hash === "") {
         setRoute("home");
       } else if (hash === "/analyze") {
         setRoute("analyze");
       } else if (hash === "/result") {
         setRoute("result");
       } else {
         setRoute("home");
       }
     };
 
     handleHashChange();
     window.addEventListener("hashchange", handleHashChange);
     return () => window.removeEventListener("hashchange", handleHashChange);
   }, []);
 
   const navigate = (newRoute: Route, data?: ResultData) => {
     if (data) setResultData(data);
     window.location.hash = newRoute === "home" ? "/" : `/${newRoute}`;
   };
 
   return (
     <div className="min-h-screen bg-background">
       <Navbar onNavigate={navigate} />
       {route === "home" && <Landing onNavigate={navigate} />}
       {route === "analyze" && <Analyzer onNavigate={navigate} onResult={setResultData} />}
       {route === "result" && <Result data={resultData} onNavigate={navigate} />}
     </div>
   );
 }
 
 export interface ResultData {
   totalMarks: number;
   totalCorrect: number;
   totalWrong: number;
   totalUnattempted: number;
   accuracy: number;
   negativeMarks: number;
   mathMarks: number;
   physicsMarks: number;
   chemistryMarks: number;
   examDate: string;
   shift: string;
   percentile: string;
 }
 
 export default App;