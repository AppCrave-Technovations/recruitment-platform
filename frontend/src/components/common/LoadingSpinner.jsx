import React from 'react';

function LoadingSpinner({ 
  size = 'md', 
  variant = 'spinner', 
  color = 'blue', 
  text = '', 
  overlay = false,
  className = '',
  fullScreen = false,
  inline = false
}) {
  
  // Size configurations
  const sizeClasses = {
    xs: { spinner: 'h-3 w-3', dot: 'h-1 w-1', text: 'text-xs' },
    sm: { spinner: 'h-4 w-4', dot: 'h-1.5 w-1.5', text: 'text-sm' },
    md: { spinner: 'h-8 w-8', dot: 'h-2 w-2', text: 'text-base' },
    lg: { spinner: 'h-12 w-12', dot: 'h-3 w-3', text: 'text-lg' },
    xl: { spinner: 'h-16 w-16', dot: 'h-4 w-4', text: 'text-xl' }
  };

  // Color configurations
  const colorClasses = {
    blue: {
      primary: 'border-blue-600',
      secondary: 'border-blue-200',
      dot: 'bg-blue-600',
      text: 'text-blue-600'
    },
    gray: {
      primary: 'border-gray-600',
      secondary: 'border-gray-200',
      dot: 'bg-gray-600',
      text: 'text-gray-600'
    },
    green: {
      primary: 'border-green-600',
      secondary: 'border-green-200',
      dot: 'bg-green-600',
      text: 'text-green-600'
    },
    red: {
      primary: 'border-red-600',
      secondary: 'border-red-200',
      dot: 'bg-red-600',
      text: 'text-red-600'
    },
    yellow: {
      primary: 'border-yellow-600',
      secondary: 'border-yellow-200',
      dot: 'bg-yellow-600',
      text: 'text-yellow-600'
    },
    purple: {
      primary: 'border-purple-600',
      secondary: 'border-purple-200',
      dot: 'bg-purple-600',
      text: 'text-purple-600'
    },
    white: {
      primary: 'border-white',
      secondary: 'border-white/30',
      dot: 'bg-white',
      text: 'text-white'
    }
  };

  const currentSize = sizeClasses[size];
  const currentColor = colorClasses[color];

  // Spinner variants
  const SpinnerVariant = () => (
    <div
      className={`animate-spin rounded-full border-2 ${currentColor.secondary} ${currentColor.primary} border-t-transparent ${currentSize.spinner}`}
      role="status"
      aria-label="Loading"
    />
  );

  const DotsVariant = () => (
    <div className="flex space-x-1" role="status" aria-label="Loading">
      <div
        className={`${currentColor.dot} ${currentSize.dot} rounded-full animate-bounce`}
        style={{ animationDelay: '0ms' }}
      />
      <div
        className={`${currentColor.dot} ${currentSize.dot} rounded-full animate-bounce`}
        style={{ animationDelay: '150ms' }}
      />
      <div
        className={`${currentColor.dot} ${currentSize.dot} rounded-full animate-bounce`}
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );

  const PulseVariant = () => (
    <div
      className={`${currentColor.dot} ${currentSize.spinner} rounded-full animate-pulse`}
      role="status"
      aria-label="Loading"
    />
  );

  const BarsVariant = () => (
    <div className="flex items-center space-x-1" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${currentColor.dot} ${currentSize.dot} animate-pulse`}
          style={{
            height: size === 'xs' ? '12px' : size === 'sm' ? '16px' : size === 'md' ? '24px' : size === 'lg' ? '32px' : '40px',
            width: size === 'xs' ? '3px' : size === 'sm' ? '4px' : size === 'md' ? '6px' : size === 'lg' ? '8px' : '10px',
            animationDelay: `${i * 150}ms`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );

  const RingVariant = () => (
    <div className="relative" role="status" aria-label="Loading">
      <div
        className={`${currentSize.spinner} rounded-full border-2 ${currentColor.secondary}`}
      />
      <div
        className={`absolute top-0 left-0 ${currentSize.spinner} rounded-full border-2 border-transparent ${currentColor.primary} border-t-2 animate-spin`}
      />
    </div>
  );

  const DotsCircleVariant = () => (
    <div className="relative" role="status" aria-label="Loading">
      <div className={`${currentSize.spinner} relative`}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={`absolute ${currentSize.dot} ${currentColor.dot} rounded-full animate-spin`}
            style={{
              left: '50%',
              top: '50%',
              transform: `rotate(${i * 45}deg) translateY(-${size === 'xs' ? '6px' : size === 'sm' ? '8px' : size === 'md' ? '16px' : size === 'lg' ? '24px' : '32px'}) translateX(-50%)`,
              animationDelay: `${i * 125}ms`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    </div>
  );

  const GridVariant = () => (
    <div className="grid grid-cols-3 gap-1" role="status" aria-label="Loading">
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          className={`${currentSize.dot} ${currentColor.dot} animate-pulse`}
          style={{
            animationDelay: `${(i % 3) * 150 + Math.floor(i / 3) * 100}ms`,
            animationDuration: '1.5s'
          }}
        />
      ))}
    </div>
  );

  // Recruitment-themed variants
  const RecruitmentVariant = () => (
    <div className="flex items-center space-x-2" role="status" aria-label="Loading">
      <div className="relative">
        <div className="text-2xl animate-bounce">👤</div>
        <div className="absolute -bottom-1 -right-1 text-xs animate-spin">⚙️</div>
      </div>
      {text && <span className={`${currentColor.text} ${currentSize.text} animate-pulse`}>
        {text}
      </span>}
    </div>
  );

  const AIProcessingVariant = () => (
    <div className="flex items-center space-x-2" role="status" aria-label="AI Processing">
      <div className="relative">
        <div className="text-2xl animate-pulse">🤖</div>
        <div className="absolute -top-1 -right-1 text-xs animate-spin">✨</div>
      </div>
      {text && <span className={`${currentColor.text} ${currentSize.text}`}>
        {text}
      </span>}
    </div>
  );

  // Render appropriate variant
  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsVariant />;
      case 'pulse':
        return <PulseVariant />;
      case 'bars':
        return <BarsVariant />;
      case 'ring':
        return <RingVariant />;
      case 'dots-circle':
        return <DotsCircleVariant />;
      case 'grid':
        return <GridVariant />;
      case 'recruitment':
        return <RecruitmentVariant />;
      case 'ai-processing':
        return <AIProcessingVariant />;
      case 'spinner':
      default:
        return <SpinnerVariant />;
    }
  };

  // Content wrapper
  const SpinnerContent = () => (
    <>
      {renderSpinner()}
      {text && !['recruitment', 'ai-processing'].includes(variant) && (
        <div className={`mt-3 ${currentColor.text} ${currentSize.text} text-center`}>
          {text}
        </div>
      )}
    </>
  );

  // Inline spinner (no wrapper)
  if (inline) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        {renderSpinner()}
        {text && (
          <span className={`ml-2 ${currentColor.text} ${currentSize.text}`}>
            {text}
          </span>
        )}
      </span>
    );
  }

  // Full screen overlay
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center">
          <SpinnerContent />
        </div>
      </div>
    );
  }

  // Overlay mode
  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 backdrop-blur-sm z-10">
        <div className="flex flex-col items-center">
          <SpinnerContent />
        </div>
      </div>
    );
  }

  // Standard wrapper
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <SpinnerContent />
    </div>
  );
}

// Specialized loading components for common use cases
function PageLoader({ text = 'Loading...', color = 'blue' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner 
          size="lg" 
          variant="spinner" 
          color={color}
          text={text}
        />
      </div>
    </div>
  );
}

function TableLoader({ rows = 5, columns = 4 }) {
  return (
    <div className="animate-pulse">
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 py-3">
          {[...Array(columns)].map((_, colIndex) => (
            <div 
              key={colIndex} 
              className="h-4 bg-gray-200 rounded flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardLoader({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(count)].map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="bg-white rounded-lg border p-6">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ButtonLoader({ size = 'md', text = 'Loading...', disabled = true }) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center ${sizeClasses[size]} font-medium rounded-md text-white bg-gray-400 cursor-not-allowed`}
    >
      <LoadingSpinner 
        size="sm" 
        variant="spinner" 
        color="white" 
        inline 
        className="mr-2"
      />
      {text}
    </button>
  );
}

// Export all components
export default LoadingSpinner;
export { 
  PageLoader, 
  TableLoader, 
  CardLoader, 
  ButtonLoader 
};