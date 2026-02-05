 import { ReactNode } from "react";
 
 interface BadgeProps {
   children: ReactNode;
   className?: string;
 }
 
 export function Badge({ children, className = "" }: BadgeProps) {
   return (
     <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
       {children}
     </span>
   );
 }