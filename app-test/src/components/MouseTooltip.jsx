import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

function MouseTooltip({ offset = { x: 15, y: -10 } }) {
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = createSignal(false);
  const [hoveredButton, setHoveredButton] = createSignal(null);

  onMount(() => {
    console.log('🖱️ MouseTooltip mounted');
    
    const handleMouseMove = (e) => {
      setPosition({ 
        x: e.clientX + offset.x, 
        y: e.clientY + offset.y 
      });

      // ✅ Detect button hover with more debugging
      const button = e.target.closest('button');
      
      if (button) {
        const buttonInfo = getButtonInfo(button);
        console.log('🔘 Button hovered:', buttonInfo);
        setHoveredButton(buttonInfo);
      } else {
        setHoveredButton(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    onCleanup(() => {
      console.log('🖱️ MouseTooltip cleanup');
      window.removeEventListener('mousemove', handleMouseMove);
    });
  });

  // Always show tooltip when hovering buttons
  createEffect(() => {
    const shouldShow = hoveredButton() !== null;
    setIsVisible(shouldShow);
    if (shouldShow) {
      console.log('✅ Tooltip should be visible:', hoveredButton());
    }
  });

  return (
    <div
      class={`fixed pointer-events-none transition-opacity duration-200 ${
        isVisible() ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        left: `${position().x}px`,
        top: `${position().y}px`,
        'z-index': '99999', // ✅ Very high z-index
        position: 'fixed'
      }}
    >
      <div 
        class="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-xl text-sm whitespace-nowrap max-w-xs border border-gray-600"
        style={{
          'box-shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
        }}
      >
        {hoveredButton() && (
          <div>
            <div class="font-semibold text-yellow-300">
              🔘 {hoveredButton().displayText}
            </div>
            <div class="text-xs text-gray-300 mt-1">
              {hoveredButton().description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Enhanced button detection with more logging
function getButtonInfo(button) {
  const text = button.textContent?.trim() || '';
  const hasIcon = button.querySelector('svg') !== null;
  
  console.log('🔍 Analyzing button:', { text, hasIcon, element: button });
  
  // Identify buttons by their content
  if (text === '+') return { displayText: 'Expand', description: 'Expand control panel' };
  if (text === '-') return { displayText: 'Collapse', description: 'Collapse control panel' };
  if (text === '-3') return { displayText: 'Decrease', description: 'Decrease iterations by 3' };
  
  // Numeric buttons (iteration counter)
  if (text.match(/^\d+$/)) {
    const num = parseInt(text);
    return { 
      displayText: `Iterations: ${text}`, 
      description: `Max iterations: ${2 ** num} (2^${text})` 
    };
  }
  
  // Icon-only buttons
  if (hasIcon && !text) {
    const svg = button.querySelector('svg');
    const path = svg?.querySelector('path')?.getAttribute('d') || '';
    
    if (path.includes('M12 9v6m3-3H9')) {
      return { displayText: 'Toggle Display', description: 'Switch between numbers and icons' };
    }
    
    // More icon detection
    if (path.includes('settings') || path.includes('cog')) {
      return { displayText: 'Settings', description: 'Open settings menu' };
    }
  }
  
  // Check for common button patterns
  if (button.className.includes('cascade')) {
    return { displayText: 'Multi-function', description: 'Color scheme / Navigation' };
  }
  
  // Generic button fallback
  return { displayText: text || 'Button', description: 'Interactive control' };
}

export default MouseTooltip;