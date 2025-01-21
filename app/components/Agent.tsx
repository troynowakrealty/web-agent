'use client';

import { useState, useRef } from 'react';
import { useAgent } from '../hooks/useAgent';
import clsx from 'clsx';
import { FiPlay, FiLoader } from 'react-icons/fi';

export default function Agent() {
  const [goalInput, setGoalInput] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const {
    goal,
    steps,
    isProcessing,
    error,
    isComplete,
    currentUrl,
    screenshot,
    startMission,
    reset
  } = useAgent();

  console.log(steps);

  // Auto-scroll timeline when new steps are added
  const scrollToBottom = () => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    
    await startMission(goalInput.trim());
    scrollToBottom();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0A0F1D] text-[#E5E5E5] font-mono">
      {/* Header */}
      <div className="bg-black/40 border-b border-[#E5B64A]/30 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center relative">
          <div className="absolute left-0">
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke="#E5B64A" strokeWidth="2" strokeDasharray="4 4"/>
                <circle cx="20" cy="20" r="2" fill="#E5B64A"/>
                <path d="M20 5V35M5 20H35" stroke="#E5B64A" strokeWidth="1"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-[0.2em] text-[#E5B64A]">007 AGENT</h1>
            <p className="text-xs text-[#E5B64A]/70 tracking-[0.3em] mt-1">v0.1 BETA • CLASSIFIED</p>
          </div>
          <div className="absolute right-0">
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke="#E5B64A" strokeWidth="2" strokeDasharray="4 4"/>
                <circle cx="20" cy="20" r="2" fill="#E5B64A"/>
                <path d="M20 5V35M5 20H35" stroke="#E5B64A" strokeWidth="1"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-4">
        {/* Left Panel - Mission Status & Control */}
        <div className="w-full md:w-96 flex flex-col gap-4 overflow-hidden">
          {/* Mission Status */}
          <div className="flex-1 bg-black/40 rounded-lg border border-[#E5B64A]/30 p-4 overflow-hidden flex flex-col">
            <h2 className="text-lg font-bold tracking-wide mb-4 text-[#E5B64A]">MISSION STATUS</h2>
            
            {/* Steps List */}
            <div 
              ref={timelineRef} 
              className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#E5B64A] scrollbar-track-[#E5B64A]/10"
            >
              {steps.filter(step => step.type !== 'complete').map((step, index) => (
                <div
                  key={index}
                  className={clsx(
                    "mb-2 p-3 rounded-lg border transition-colors",
                    index === steps.length - 1
                      ? "border-[#E5B64A] bg-[#E5B64A]/10"
                      : "border-[#E5B64A]/30 hover:border-[#E5B64A]/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-[#E5B64A]/50">
                      <span className="text-xs text-[#E5B64A]">{index + 1}</span>
                    </div>
                    <span className="text-sm">{step.description}</span>
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="mb-2 p-3 rounded-lg border border-[#E5B64A] bg-[#E5B64A]/10">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-[#E5B64A]/50">
                      <FiLoader className="animate-spin text-[#E5B64A]" />
                    </div>
                    <span className="text-sm">Processing next step...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-2 p-3 rounded-lg border border-red-500 bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-500">{error}</span>
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="mb-2 p-4 rounded-lg border border-emerald-500 bg-emerald-500/10">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-emerald-500">
                        <span className="text-xs text-emerald-500">✓</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-500">Mission Complete!</span>
                    </div>
                    <div className="ml-8 pl-4 border-l-2 border-emerald-500/30">
                      <p className="text-sm text-emerald-500/90 whitespace-pre-wrap">
                        {steps.find(step => step.type === 'complete')?.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mission Control */}
          <div className="bg-black/40 rounded-lg border border-[#E5B64A]/30 p-4">
            <h2 className="text-lg font-bold tracking-wide mb-4 text-[#E5B64A]">MISSION CONTROL</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="goal" className="block text-sm mb-2 text-[#E5B64A]/90">
                  ENTER MISSION PARAMETERS:
                </label>
                <textarea
                  id="goal"
                  value={goalInput}
                  onChange={(e) => {
                    setGoalInput(e.target.value);
                    // Reset height to auto to properly calculate scroll height
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (goalInput.trim() && !isProcessing) {
                        handleSubmit(e);
                      }
                    }
                  }}
                  rows={1}
                  className="w-full bg-black/50 border border-[#E5B64A]/30 rounded px-3 py-2 text-white resize-none overflow-hidden"
                  placeholder="Enter your goal..."
                  disabled={isProcessing}
                  style={{ minHeight: '2.5rem' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing || !goalInput}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded font-medium transition-colors',
                    isProcessing || !goalInput
                      ? 'bg-[#E5B64A]/30 cursor-not-allowed'
                      : 'bg-[#E5B64A] hover:bg-[#E5B64A]/90 text-black'
                  )}
                >
                  {isProcessing ? (
                    <>
                      <FiLoader className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiPlay />
                      INITIALIZE MISSION
                    </>
                  )}
                </button>
                {goal && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded border border-[#E5B64A]/30 hover:border-[#E5B64A] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col bg-black/40 rounded-lg border border-[#E5B64A]/30 overflow-hidden">
          <div className="p-4 border-b border-[#E5B64A]/30 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-wide text-[#E5B64A]">MISSION VIEWPORT</h2>
            {currentUrl && (
              <span className="text-sm text-[#E5B64A] opacity-80 truncate max-w-[50%]">
                {currentUrl}
              </span>
            )}
          </div>
          <div className="flex-1 relative bg-black/50 overflow-auto">
            {currentUrl && screenshot ? (
              <div className="min-h-full">
                <img 
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Current webpage"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 relative mx-auto">
                    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="48" cy="48" r="46" stroke="#E5B64A" strokeWidth="2" strokeDasharray="8 8"/>
                      <circle cx="48" cy="48" r="4" fill="#E5B64A"/>
                      <path d="M48 0V96M0 48H96" stroke="#E5B64A" strokeWidth="2"/>
                    </svg>
                  </div>
                  <p className="text-xl text-[#E5B64A] font-bold tracking-wider">
                    {currentUrl ? 'PROCESSING MISSION...' : 'AWAITING MISSION BRIEFING...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 