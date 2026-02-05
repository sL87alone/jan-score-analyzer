 import { Zap, Moon, Sun } from "lucide-react";
 import { useState, useEffect } from "react";
 
 interface NavbarProps {
   onNavigate: (route: "home" | "analyze" | "result") => void;
 }
 
 export function Navbar({ onNavigate }: NavbarProps) {
   const [isDark, setIsDark] = useState(false);
 
   useEffect(() => {
     const savedTheme = localStorage.getItem("theme");
     if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
       setIsDark(true);
       document.documentElement.classList.add("dark");
     }
   }, []);
 
   const toggleTheme = () => {
     setIsDark(!isDark);
     document.documentElement.classList.toggle("dark");
     localStorage.setItem("theme", isDark ? "light" : "dark");
   };
 
   return (
     <nav className="fixed top-0 left-0 right-0 z-50 glass border-b">
       <div className="container mx-auto px-4 h-16 flex items-center justify-between">
         <button
           onClick={() => onNavigate("home")}
           className="flex items-center gap-2 font-bold text-xl"
         >
           <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
             <Zap className="w-5 h-5 text-primary-foreground" />
           </div>
           <span>Jan Score Analyzer</span>
         </button>
 
         <div className="flex items-center gap-4">
           <button
             onClick={() => onNavigate("analyze")}
             className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
           >
             Analyze
           </button>
           <button
             onClick={toggleTheme}
             className="w-9 h-9 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors"
           >
             {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
           </button>
         </div>
       </div>
     </nav>
   );
 }