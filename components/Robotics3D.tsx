'use client'

import { useEffect, useRef } from 'react'

/**
 * Robotic Arm - CSS-animated visual element
 * The animation keyframes are defined in globals.css
 */
export function RoboticArm() {
  return (
    <div className="relative w-48 h-64 md:w-64 md:h-80 orbit-pattern" aria-hidden="true">
      {/* Base */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-cobalt rounded-full border-2 border-line" aria-hidden="true" />

      {/* Upper Arm */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-24 bg-slate-800 rounded-t rounded-br-3xl rounded-bl-3xl transform origin-bottom transition-all duration-700" aria-hidden="true" />

      {/* Lower Arm */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-20 bg-slate-700 rounded-t rounded-br-2xl rounded-bl-2xl transform rotate-[30deg] transition-all duration-700" aria-hidden="true" />

      {/* Gripper */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-8 bg-slate-600 rounded transform rotate-[45deg] transition-all duration-700" aria-hidden="true" />

      {/* Motor Mount */}
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute -inset-2 border-2 border-white/5 rounded-full" />
      </div>
    </div>
  )
}