'use client';

import { useState, useRef } from 'react';
import { useAgent } from '../hooks/useAgent';
import clsx from 'clsx';
import { FiPlay, FiLoader, FiX, FiMinus, FiMaximize2 } from 'react-icons/fi';
import { useAIConfig } from '../hooks/useAIConfig';

export default function Agent() {
  const [goalInput, setGoalInput] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const {
    goal,
    actions,
    isProcessing,
    error,
    isComplete,
    currentUrl,
    screenshot,
    startMission,
    reset
  } = useAgent();
  const aiConfig = useAIConfig();

  // Auto-scroll timeline when new actions are added
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
      <div className="bg-black/40 border-b border-[#4B9CDB]/30 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center relative">
          <div className="absolute left-0">
            <img src="/airas-icon.svg" alt="Airas Logo" className="w-8 h-8" />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <img src="/airas-logo.svg" alt="Airas" className="h-8" />
              <h1 className="text-3xl font-bold tracking-[0.2em] text-[#4B9CDB]">AGENT</h1>
            </div>
            <p className="text-xs text-[#4B9CDB]/70 tracking-[0.3em] mt-1">v0.1 BETA • CLASSIFIED</p>
            {aiConfig && (
              <div className="mt-2 flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4B9CDB]/70">PROVIDER:</span>
                  <span className="text-xs text-[#4B9CDB] uppercase">{aiConfig.provider}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4B9CDB]/70">MODEL:</span>
                  <span className="text-xs text-[#4B9CDB]">
                    {aiConfig.provider === 'openai' ? aiConfig.openai?.model : aiConfig.ollama?.model}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4B9CDB]/70">VISION:</span>
                  <span className="text-xs text-[#4B9CDB]">
                    {aiConfig.provider === 'openai' ? aiConfig.openai?.visionModel : aiConfig.ollama?.visionModel}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="absolute right-0">
            <img src="/airas-icon.svg" alt="Airas Logo" className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-4">
        {/* Left Panel - Mission Status & Control */}
        <div className="w-full md:w-96 flex flex-col gap-4 overflow-hidden">
          {/* Mission Status */}
          <div className="flex-1 bg-black/40 rounded-lg border border-[#4B9CDB]/30 p-4 overflow-hidden flex flex-col">
            <h2 className="text-lg font-bold tracking-wide mb-4 text-[#4B9CDB]">MISSION STATUS</h2>
            
            {/* Actions List */}
            <div 
              ref={timelineRef} 
              className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#4B9CDB] scrollbar-track-[#4B9CDB]/10"
            >
              {actions.filter(action => action.type !== 'complete').map((action, index) => (
                <div
                  key={index}
                  className={clsx(
                    "mb-2 p-3 rounded-lg border transition-colors",
                    index === actions.length - 1
                      ? "border-[#4B9CDB] bg-[#4B9CDB]/10"
                      : "border-[#4B9CDB]/30 hover:border-[#4B9CDB]/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-[#4B9CDB]/50">
                      <span className="text-xs text-[#4B9CDB]">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm">{action.description}</span>
                      {action.type === 'goto' && (
                        <div className="mt-1 text-xs text-[#4B9CDB]/70 truncate">
                          {action.url}
                        </div>
                      )}
                      {action.type === 'click' && 'text' in action && typeof action.text === 'string' && (
                        <div className="mt-1 text-xs text-[#4B9CDB]/70">
                          Clicking: "{action.text}"
                        </div>
                      )}
                      {action.type === 'type' && (
                        <div className="mt-1 text-xs text-[#4B9CDB]/70">
                          Typing: "{action.text}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="mb-2 p-3 rounded-lg border border-[#4B9CDB] bg-[#4B9CDB]/10">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-[#4B9CDB]/50">
                      <FiLoader className="animate-spin text-[#4B9CDB]" />
                    </div>
                    <span className="text-sm">Processing next action...</span>
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
                        {actions.find(action => action.type === 'complete')?.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mission Control */}
          <div className="bg-black/40 rounded-lg border border-[#4B9CDB]/30 p-4">
            <h2 className="text-lg font-bold tracking-wide mb-4 text-[#4B9CDB]">MISSION CONTROL</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="goal" className="block text-sm mb-2 text-[#4B9CDB]/90">
                  ENTER MISSION PARAMETERS:
                </label>
                <textarea
                  id="goal"
                  value={goalInput}
                  onChange={(e) => {
                    setGoalInput(e.target.value);
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
                  className="w-full bg-black/50 border border-[#4B9CDB]/30 rounded px-3 py-2 text-white resize-none overflow-hidden focus:border-[#4B9CDB] focus:outline-none transition-colors"
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
                      ? 'bg-[#4B9CDB]/30 cursor-not-allowed'
                      : 'bg-[#4B9CDB] hover:bg-[#4B9CDB]/90 text-black'
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
                    className="px-4 py-2 rounded border border-[#4B9CDB]/30 hover:border-[#4B9CDB] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col bg-black/40 rounded-lg border border-[#4B9CDB]/30 overflow-hidden">
          {/* Browser Chrome */}
          <div className="bg-[#1A1F2E] border-b border-[#4B9CDB]/30 flex items-center p-2 gap-2">
            <div className="flex items-center gap-1.5">
              <button className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#FF5F57]/50" />
              <button className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#FFBD2E]/50" />
              <button className="w-3 h-3 rounded-full bg-[#28C840] border border-[#28C840]/50" />
            </div>
            {currentUrl && (
              <div className="flex-1 ml-4">
                <div className="bg-[#0A0F1D] rounded px-3 py-1 text-sm text-[#4B9CDB]/70 truncate border border-[#4B9CDB]/20">
                  {currentUrl}
                </div>
              </div>
            )}
          </div>

          {/* Browser Content */}
          <div className="flex-1 relative bg-[#0A0F1D] overflow-auto">
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
                    <img src="/airas-icon.svg" alt="Airas Logo" className="w-full h-full opacity-30" />
                  </div>
                  <p className="text-xl text-[#4B9CDB] font-bold tracking-wider">
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