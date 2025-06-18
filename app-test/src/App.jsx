import { createSignal, createEffect, onMount, onCleanup, batch, createMemo } from 'solid-js';
import { createMousePosition } from '@solid-primitives/mouse';
import { Tooltip } from "@kobalte/core/tooltip";

import Button from './components/Button';
import CascadeButton from './components/CascadeButton';
import SideCascade from './components/SideCascade';
import Modal from './components/Modal';
import RegionCascade from './components/RegionCascade';
import { useTranslation } from './i18n/useTranslation.js';

function App() {
  // Pixel to complex coordinate conversion
  const pixel_to_complex = (x, y, zoom, real_center, imag_center) => {
    const SCREEN_WIDTH = 960;
    const SCREEN_HEIGHT = 720;

    // Calculate the size of the viewing area in the complex plane
    const real_width = 3 / (2 ** zoom);
    const imag_height = 2 / (2 ** zoom);

    // Calculate how much each pixel represents in complex coordinates
    const step_real = real_width / SCREEN_WIDTH;
    const step_imag = imag_height / SCREEN_HEIGHT;

    // Find the boundaries of the viewing area
    const real_min = real_center - real_width / 2;
    const imag_max = imag_center + imag_height / 2;

    // Convert pixel coordinates to complex coordinates
    const real = real_min + step_real * x;
    const imag = imag_max - step_imag * y;  // Note: y-axis is flipped

    return [real, imag];
  };

  const { t, setLanguage, currentLanguage } = useTranslation();
  
  const pos = createMousePosition(window);
  const [mouseWheelDelta, setMouseWheelDelta] = createSignal(0);
  const [isDarkMode, setIsDarkMode] = createSignal(false);
  const [colourScheme, setColourScheme] = createSignal("classic");
  const [centerX, setCenterX] = createSignal(-0.5);
  const [centerY, setCenterY] = createSignal(0.0);
  
  // UI state
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [showNumbers, setShowNumbers] = createSignal(false);
  const [counter, setCounter] = createSignal(8);
  
  // Modal states - combined into object for cleaner management
  const [modals, setModals] = createSignal({
    main: false,
    theory: false,
    config: false,
    optimizations: false,
    accessibility: false,
    usageBlur: false
  });
  
  // Input tracking
  const [centerXInput, setCenterXInput] = createSignal(centerX().toFixed(8));
  const [centerYInput, setCenterYInput] = createSignal(centerY().toFixed(8));
  
  // WebSocket
  const [mandelbrotImage, setMandelbrotImage] = createSignal('');
  const [websocket, setWebsocket] = createSignal(null);          // For FPGA parameters
  const [laptopWebsocket, setLaptopWebsocket] = createSignal(null); // For processed frames

  // Add TTS state
  const [isTTSEnabled, setIsTTSEnabled] = createSignal(false);
  const [speechRate, setSpeechRate] = createSignal(1.0);
  const [isReading, setIsReading] = createSignal(false);

  // Memoized complex coordinate calculation for performance
  const currentComplexCoordinates = createMemo(() => {
    return pixel_to_complex(
      pos.x || 0,
      pos.y || 0,
      mouseWheelDelta(),
      centerX(),
      centerY()
    );
  });

  // Helper to update modal state
  const toggleModal = (modal, state = null) => {
    setModals(prev => ({
      ...prev,
      [modal]: state !== null ? state : !prev[modal]
    }));
  };

  // Dark mode effect
  createEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode());
  });

  // Mouse wheel handler - capped at 32 with ** operator
  onMount(() => {
    const handleWheel = (event) => {
      const newValue = Math.floor(mouseWheelDelta()+ (-event.deltaY)*0.01 );
      setMouseWheelDelta(Math.max(0, Math.min(newValue, 32)));
    };

    window.addEventListener('wheel', handleWheel);
    onCleanup(() => window.removeEventListener('wheel', handleWheel));
  });

  // Create a capped setter function:
  const setCounterCapped = (value) => {
    setCounter(Math.max(1, Math.min(value, 9)));
  };

  // Event handlers - simplified
  const toggleCollapse = () => {
    if (showNumbers()) {
      setCounterCapped(counter() - 3);
    } else {
      setIsCollapsed(!isCollapsed());
    }
  };

  const handlePlusClick = () => {
    setShowNumbers(!showNumbers());
  };
  const handlePlusOne = () => setCounterCapped(counter() + 1);
  const handleMinusOne = () => setCounterCapped(counter() - 1);
  const handlePlusTen = () => setCounterCapped(counter() + 3);
  const changeColourScheme = (scheme) => setColourScheme(scheme);

  // Input handlers - consolidated
  const createInputHandler = (setter, signalSetter) => (e) => {
    const inputValue = e.target.value;
    setter(inputValue);
    
    const floatValue = parseFloat(inputValue);
    if (!isNaN(floatValue)) {
      signalSetter(Math.max(-8.0, Math.min(7.999999999, floatValue)));
    }
  };

  const handleCenterXInput = createInputHandler(setCenterXInput, setCenterX);
  const handleCenterYInput = createInputHandler(setCenterYInput, setCenterY);

  // Sync input fields when values change programmatically
  createEffect(() => {
    if (document.activeElement?.getAttribute('data-input') !== 'centerX') {
      setCenterXInput(centerX().toFixed(8));
    }
  });

  createEffect(() => {
    if (document.activeElement?.getAttribute('data-input') !== 'centerY') {
      setCenterYInput(centerY().toFixed(8));
    }
  });

  const regionChange = (region) => {
    batch(() => {
      setCenterX(region.centerX);
      setCenterY(region.centerY);
      setMouseWheelDelta(region.zoom);
    });
  };

  // WebSocket setup
  onMount(() => {
    // Connection 1: Send parameters to FPGA
    const fpgaWs = new WebSocket('ws://192.168.137.225:8080');
    
    fpgaWs.onopen = () => {
        console.log('🔧 Connected to FPGA parameter server!');
        setWebsocket(fpgaWs);  // This is used for sending parameters
    };
    
    fpgaWs.onerror = (error) => console.error('FPGA WebSocket error:', error);
    fpgaWs.onclose = () => console.log('FPGA parameter connection closed');

    // Connection 2: Receive processed frames from laptop
    const laptopWs = new WebSocket('ws://localhost:8001');
    
    laptopWs.onopen = () => {
        console.log('💻 Connected to laptop frame server!');
        setLaptopWebsocket(laptopWs);
    };

    laptopWs.onmessage = (event) => {
        // Handle processed frames from laptop
        if (event.data instanceof Blob) {
            const url = URL.createObjectURL(event.data);
            setMandelbrotImage(url);
            
            // Clean up old URLs to prevent memory leaks
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
    };
    
    laptopWs.onerror = (error) => console.error('Laptop WebSocket error:', error);
    laptopWs.onclose = () => console.log('Laptop frame connection closed');

    onCleanup(() => {
        fpgaWs?.close();
        laptopWs?.close();
    });
  });
  
  // Send parameters when they change
  createEffect(() => {
    const ws = websocket(); // This now connects to FPGA
    if (ws?.readyState === WebSocket.OPEN) {
      const params = {
        re_c: centerX(),
        im_c: centerY(),
        zoom: mouseWheelDelta(),
        max_iter: counter(),
        // colour_sch: colourScheme() (will be handled in .py program)
      };
      ws.send(JSON.stringify(params));
      console.log('📤 Sending to FPGA:', params); // ✅ Now params is defined!
    }
  });

  // TTS functionality
  const speak = (text) => {
    if (!isTTSEnabled() || !text) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate();
    utterance.lang = currentLanguage() === 'en' ? 'en-US' : 
                     currentLanguage() === 'es' ? 'es-ES' :
                     currentLanguage() === 'zh' ? 'zh-CN' : 
                     currentLanguage() === 'ar' ? 'ar-SA' : 'en-US';
    
    utterance.onstart = () => setIsReading(true);
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
  };

  // Common input props for reusability
  const inputProps = {
    class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-green-500 focus:outline-none appearance-none",
    style: { "-webkit-appearance": "none", "-moz-appearance": "textfield" },
    onFocus: () => setTimeout(() => document.activeElement?.select(), 0),
    onDblClick: (e) => e.target.select()
  };

  // Modal button props for reusability
  const modalButtonClass = "w-full py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700";

  return (
    <>
      {modals().usageBlur && (
        <div 
          class="fixed inset-0 backdrop-blur-md bg-opacity-20 z-40"
          onClick={() => toggleModal('usageBlur', false)}
          style={{ "pointer-events": "all" }}
        />
      )}
      
      <style jsx global>{`
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 960px;
          height: 720px;
          overflow: hidden;
        }
        
        .ui-controls, .coordinates {
          direction: ltr !important;
          left: 0px !important;
          right: auto !important;
        }

        button, .button, [role="button"], 
        button *, .button *, [role="button"] *,
        .w-12.h-12.flex.items-center.justify-center,
        svg, emoji {
          user-select: none !important;
          cursor: pointer !important;
        }
      `}</style>

      <div class="w-full h-screen border-0 overflow-hidden relative bg-gray-900 dark:bg-gray-900">
        <div style={{
          "background-image": `url('${mandelbrotImage() || "data:image/jpeg;base64,iVBORw0K..."}')`,
          "background-size": "cover",
          "background-position": "center",
          "background-repeat": "no-repeat",
          "width": "100%",
          "height": "100%"
        }}>
          <div class="p-3 ui-controls" style={{ position: "absolute", "z-index": "10" }}>
            <div class="flex flex-col items-start gap-3 w-fit">
              <Button onClick={toggleCollapse} isDarkMode={isDarkMode()}>
                {showNumbers() ? "-3" : (isCollapsed() ? "+" : "-")}
              </Button>
              
              <div 
                class="flex flex-col gap-3 overflow-hidden transition-all duration-500 ease-in-out origin-top"
                style={{
                  "transform": isCollapsed() ? "scaleY(0)" : "scaleY(1)",
                  "opacity": isCollapsed() ? "0" : "1"
                }}
              >
                <CascadeButton 
                  showNumbers={showNumbers()} 
                  onMinusOne={handleMinusOne}
                  isDarkMode={isDarkMode()}
                  onSchemeChange={changeColourScheme}
                  currentColourScheme={colourScheme()}
                />
                
                <Button onClick={handlePlusClick} isDarkMode={isDarkMode()}>
                  {showNumbers() ? counter() : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  )}
                </Button>
                
                <RegionCascade
                  showNumbers={showNumbers()}  
                  onPlusOne={handlePlusOne} 
                  onJump={regionChange}
                  isDarkMode={isDarkMode()}
                />
                
                <SideCascade
                  showNumbers={showNumbers()} 
                  onMinusOne={handlePlusTen}
                  isDarkMode={isDarkMode()}
                  setIsDarkMode={setIsDarkMode}
                  setIsModalOpen={(state) => toggleModal('main', state)}
                  setIsConfigModal={(state) => toggleModal('config', state)}
                  isUsageBlur={() => modals().usageBlur}
                  setIsUsageBlur={(state) => toggleModal('usageBlur', state)}
                />
              </div>
            </div>
          </div>
          
          <div 
            class={`absolute bottom-0 -left-50 text-sm font-mono px-5 py-1 rounded coordinates ${
              !isDarkMode() ? 'text-black bg-white/50' : 'text-white bg-black/50'
            }`}
            style={{ "z-index": "10" }}
          >
            {(() => {
              const [real, imag] = currentComplexCoordinates();
              return (
                <>
                  {/* Pixel: ({pos.x}, {pos.y})<br/> */}
                  ({real.toFixed(6)})<br/>
                  ({imag.toFixed(6)}i)<br/>
                  {t('zoom')}: {2 ** mouseWheelDelta()}
                </>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Main Modal */}
      <Modal 
        title={t('title')}
        content={
          <div>
            <h3 class="mb-4">{t('subtitle')}</h3>
            <div class="grid grid-cols-2 gap-3">
              {[
                { key: 'theory', action: () => { toggleModal('main', false); toggleModal('theory', true); }},
                { key: 'usage', action: () => {} },
                { key: 'optimisations', action: () => { toggleModal('main', false); toggleModal('optimizations', true); }},
                { key: 'accessibility', action: () => { toggleModal('main', false); toggleModal('accessibility', true); }}
              ].map(item => (
                <button type="button" class={modalButtonClass} onClick={item.action}>
                  {t(item.key)}
                </button>
              ))}
            </div>
          </div>
        }
        isOpen={() => modals().main} 
        onClose={() => toggleModal('main', false)} 
      />
      
      {/* Other Modals */}
      <Modal 
        title={t('theory')}
        content={
          <div class="max-h-96 overflow-y-auto pr-2">
            <div class="flex justify-between items-center mb-3">
              <button
                onClick={() => speak(t('theoryContent'))}
                disabled={!isTTSEnabled() || isReading()}
                class={`px-3 py-1 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isTTSEnabled() && !isReading()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                {isReading() ? `🔊 ${t('reading')}` : `🔊 ${t('readAloud')}`}
              </button>
              
              {isReading() && (
                <button
                  onClick={stopSpeaking}
                  class="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  ⏹️ {t('stop')}
                </button>
              )}
            </div>
            <pre class="whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {t('theoryContent')}
            </pre>
          </div>
        }
        isOpen={() => modals().theory} 
        onClose={() => toggleModal('theory', false)} 
      />
      
      <Modal 
        title={t('manualConfig')}
        content={
          <div class="grid grid-cols-1 gap-4">
            {[
              { label: 'Re(c):', value: centerXInput, handler: handleCenterXInput, dataInput: 'centerX', placeholder: 'Enter real part (e.g., -0.5)' },
              { label: 'Im(c):', value: centerYInput, handler: handleCenterYInput, dataInput: 'centerY', placeholder: 'Enter imaginary part (e.g., 0.0)' }
            ].map(input => (
              <div>
                <label class="block text-sm font-medium mb-1">{input.label}</label>
                <input
                  {...inputProps}
                  type="text"
                  data-input={input.dataInput}
                  placeholder={input.placeholder}
                  value={input.value()}
                  onInput={input.handler}
                  onBlur={() => input.dataInput === 'centerX' ? setCenterXInput(centerX().toFixed(8)) : setCenterYInput(centerY().toFixed(8))}
                />
              </div>
            ))}
          </div>
        }
        isOpen={() => modals().config}
        onClose={() => toggleModal('config', false)}
      />
      
      <Modal 
        title={t('optimisations')}
        content={
          <div>
            <div class="flex justify-between items-center mb-3">
              <button
                onClick={() => speak(t('optimisationsContent'))}
                disabled={!isTTSEnabled() || isReading()}
                class={`px-3 py-1 text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isTTSEnabled() && !isReading()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                {isReading() ? `🔊 ${t('reading')}` : `🔊 ${t('readAloud')}`}
              </button>
              
              {isReading() && (
                <button
                  onClick={stopSpeaking}
                  class="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  ⏹️ {t('stop')}
                </button>
              )}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('optimisationsContent')}
            </div>
          </div>
        }
        isOpen={() => modals().optimizations}
        onClose={() => toggleModal('optimizations', false)}
      />
      
      <Modal 
        title={t('accessibility')}
        content={
          <div>
            {/* Language Settings */}
            <div class="mb-6">
              <h4 class="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                {t('languageSettings')} 
              </h4>
              <select 
                value={currentLanguage()}
                onChange={(e) => setLanguage(e.target.value)}
                class="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              >
                {[
                  { value: 'en', label: '🇺🇸 English' },
                  { value: 'es', label: '🇪🇸 Español' },
                  { value: 'zh', label: '🇨🇳 中文' },
                  { value: 'ar', label: '🇸🇦 العربية' }
                ].map(lang => (
                  <option value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>

            {/* Text-to-Speech Settings */}
            <div class="mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 class="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                🔊 {t('textToSpeech')}
              </h4>
              
              {/* TTS Enable/Disable */}
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('enableTTS')}
                </label>
                <button
                  onClick={() => setIsTTSEnabled(!isTTSEnabled())}
                  class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isTTSEnabled() ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isTTSEnabled() ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Speech Rate Control */}
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('speechRate')}: {speechRate().toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speechRate()}
                  onInput={(e) => setSpeechRate(parseFloat(e.target.value))}
                  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                  disabled={!isTTSEnabled()}
                />
                <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{t('slow')}</span>
                  <span>{t('normal')}</span>
                  <span>{t('fast')}</span>
                </div>
              </div>

              {/* Test TTS Button */}
              <div class="flex gap-2">
                <button
                  onClick={() => speak(t('ttsTestMessage'))}
                  disabled={!isTTSEnabled() || isReading()}
                  class={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isTTSEnabled() && !isReading()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                  }`}
                >
                  {isReading() ? `🔊 ${t('speaking')}` : `🔊 ${t('testSpeech')}`}
                </button>
                
                {isReading() && (
                  <button
                    onClick={stopSpeaking}
                    class="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    ⏹️ {t('stop')}
                  </button>
                )}
              </div>
            </div>
            
            {/* Existing Accessibility Content */}
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p class="text-sm text-gray-600 dark:text-gray-300">
                {t('accessibilityContent')}
              </p>
              
              {/* TTS Announcement */}
              {isTTSEnabled() && (
                <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    🔊 {t('ttsEnabled')}
                  </p>
                </div>
              )}
            </div>
          </div>
        }
        isOpen={() => modals().accessibility}
        onClose={() => toggleModal('accessibility', false)}
      />
    </>
  );
}

export default App;