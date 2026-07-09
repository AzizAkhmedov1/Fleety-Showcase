"use client";
import React from "react";
export default function FleetyLogo() {
    return (<div className="flex items-center gap-2.5 select-none antialiased transition-all duration-300 hover:opacity-95">
      <div className="drop-shadow-[0_0_14px_rgba(6,182,212,0.4)] shrink-0">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="fleetyGradient" x1="4" y1="6" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4"/>
              <stop offset="1" stopColor="#2563EB"/>
            </linearGradient>
          </defs>
          <g transform="skewX(-14) translate(2, 2)">
            <path d="M4 5.5C4 5.5 13 5 23.5 5C27.5 5 29 6.8 25.5 9.2C22 11.5 12 12 7.5 12H4V5.5Z" fill="url(#fleetyGradient)"/>
            <path d="M4 5.5V27.5C4 28.4 4.6 28.6 5.8 28C7.5 26.8 8.5 24 8.5 21.5V15.8C11.8 15.8 15.8 15.4 19 15C21.2 14.6 21.8 16.2 20.2 17.8C18.8 19.2 16.2 20.5 16.2 20.5H9V24.5H4V5.5Z" fill="url(#fleetyGradient)"/>
          </g>
        </svg>
      </div>

      <span className="text-white text-3xl font-bold tracking-tight italic font-sans lowercase antialiased">
        fleety
      </span>
    </div>);
}
