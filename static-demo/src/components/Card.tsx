 import { ReactNode } from "react";
 
 interface CardProps {
   children: ReactNode;
   className?: string;
 }
 
 export function Card({ children, className = "" }: CardProps) {
   return (
     <div className={`bg-card border rounded-xl ${className}`}>
       {children}
     </div>
   );
 }
 
 export function CardContent({ children, className = "" }: CardProps) {
   return <div className={`p-6 ${className}`}>{children}</div>;
 }