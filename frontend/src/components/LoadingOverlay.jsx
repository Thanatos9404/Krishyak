import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';

const LoadingOverlay = ({ isLoading, onComplete }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const stepRef = useRef(0);

  const steps = [
    { icon: '🌱', key: 'simulation.step1' },
    { icon: '🌦️', key: 'simulation.step2' },
    { icon: '📊', key: 'simulation.step3' },
    { icon: '💰', key: 'simulation.step4' }
  ];

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setProgress(0);
      stepRef.current = 0;
      return;
    }

    // Step progression with fixed timing
    const stepDuration = 700;
    stepRef.current = 0;

    const stepInterval = setInterval(() => {
      // Prevent completing the final step until the actual network call finishes
      if (stepRef.current < steps.length - 1) {
        stepRef.current += 1;
        setCurrentStep(stepRef.current);
      } else {
        clearInterval(stepInterval);
      }
    }, stepDuration);

    // Smooth linear progress animation (not tied to steps)
    let progressValue = 0;
    const totalDuration = stepDuration * steps.length;
    const progressIncrement = 100 / (totalDuration / 50);

    const progressInterval = setInterval(() => {
      if (progressValue < 90) {
        // Fast, linear progress for the first 90%
        progressValue += progressIncrement;
      } else {
        // Asymptotic Zeno curve: slowly approach 99% but never hit 100%
        progressValue += (99 - progressValue) * 0.05;
      }
      
      setProgress(Math.min(progressValue, 99));

      if (progressValue >= 99) {
        clearInterval(progressInterval);
      }
    }, 50);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading, steps.length]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-farm-green-400 to-farm-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            {t('simulation.running') || 'Running Simulation'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('simulation.wait') || 'This may take a few seconds'}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center p-3 rounded-xl transition-all duration-300 ${index < currentStep
                ? 'bg-green-50 border border-green-200'
                : index === currentStep
                  ? 'bg-farm-green-50 border border-farm-green-300 shadow-sm'
                  : 'bg-gray-50 border border-gray-200 opacity-50'
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${index < currentStep
                ? 'bg-green-500'
                : index === currentStep
                  ? 'bg-farm-green-500 animate-pulse'
                  : 'bg-gray-300'
                }`}>
                {index < currentStep ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-lg">{step.icon}</span>
                )}
              </div>
              <span className={`text-sm font-medium ${index <= currentStep ? 'text-gray-800' : 'text-gray-400'
                }`}>
                {t(step.key) || step.key}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar - smooth linear animation */}
        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-farm-green-400 to-farm-green-600 rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress percentage */}
        <p className="text-center text-sm text-gray-500 mt-2">
          {Math.round(progress)}% {t('simulation.complete') || 'complete'}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
