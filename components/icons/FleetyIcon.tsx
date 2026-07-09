import React from 'react';
type FleetyIconProps = React.SVGProps<SVGSVGElement>;
export default function FleetyIcon({ className, ...props }: FleetyIconProps) {
    return (<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M 34.5 42.5 
           C 34 35, 38 30, 46 30 
           H 78 
           C 85 30, 86.5 33.5, 82 37.5 
           C 77.5 41.5, 69.5 42.5, 62 42.5 
           H 34.5 Z" fill="#1E6FFF"/>
      <path d="M 37.2 47.5 
           H 60.5 
           C 64 47.5, 64.5 50.5, 62 54 
           C 59.5 57.5, 54.5 57.5, 47.5 57.5 
           H 42.5 
           L 38 72.5 
           C 37.5 74.5, 35 75, 30 75 
           C 27.2 75, 26 72.5, 27 68.5 
           L 32.5 49.5 
           C 33 47.5, 34 47.5, 37.2 47.5 
           Z" fill="#1E6FFF"/>
    </svg>);
}
