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
  let colorSchemeTimeout;

  const pixel_to_complex = (x, y, zoom, real_center, imag_center) => {
    const SCREEN_WIDTH = 960;
    const SCREEN_HEIGHT = 720;

    const real_width = 3 / (2 ** zoom);
    const imag_height = 2 / (2 ** zoom);

    const step_real = real_width / SCREEN_WIDTH;
    const step_imag = imag_height / SCREEN_HEIGHT;

    const real_min = real_center - real_width / 2;
    const imag_max = imag_center + imag_height / 2;

    const real = real_min + step_real * x;
    const imag = imag_max - step_imag * y; 

    return [real, imag];
  };

  const { t, setLanguage, currentLanguage } = useTranslation();
  
  const pos = createMousePosition(window);
  const [mouseWheelDelta, setMouseWheelDelta] = createSignal(0);
  const [isDarkMode, setIsDarkMode] = createSignal(false);
  const [colourScheme, setColourScheme] = createSignal("classic");
  const [centerX, setCenterX] = createSignal(-0.5);
  const [centerY, setCenterY] = createSignal(0.0);
  const [isJulia, setIsJulia] = createSignal(0);
  
  // UI state
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [showNumbers, setShowNumbers] = createSignal(false);
  const [counter, setCounter] = createSignal(8);
  
  const [modals, setModals] = createSignal({
    main: false,
    theory: false,
    config: false,
    optimizations: false,
    accessibility: false,
    usageBlur: false,
    // Updated region modals to match RegionCascade
    seahorse: false,
    spiralArms: false,
    minibrot: false,
    scepter: false,
    tripleSpiral: false
  });
  
  const [centerXInput, setCenterXInput] = createSignal(centerX().toFixed(8));
  const [centerYInput, setCenterYInput] = createSignal(centerY().toFixed(8));
  
 // websockets
  const [mandelbrotImage, setMandelbrotImage] = createSignal('');
  const [websocket, setWebsocket] = createSignal(null);  
  const [laptopWebsocket, setLaptopWebsocket] = createSignal(null); 

  // Add TTS state
  const [isTTSEnabled, setIsTTSEnabled] = createSignal(false);
  const [speechRate, setSpeechRate] = createSignal(1.0);
  const [isReading, setIsReading] = createSignal(false);

  const currentComplexCoordinates = createMemo(() => {
    return pixel_to_complex(
      pos.x || 0,
      pos.y || 0,
      mouseWheelDelta(),
      centerX(),
      centerY()
    );
  });

  const toggleModal = (modal, state = null) => {
    setModals(prev => ({
      ...prev,
      [modal]: state !== null ? state : !prev[modal]
    }));
  };

  // toggle dark mode
  createEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode());
  });

  onMount(() => {
    const handleWheel = (event) => {
      const newValue = Math.floor(mouseWheelDelta()+ (-event.deltaY)*0.01 );
      setMouseWheelDelta(Math.max(0, Math.min(newValue, 20)));
    };

    window.addEventListener('wheel', handleWheel);
    onCleanup(() => window.removeEventListener('wheel', handleWheel));
  });

  // changes center (a DOM value)
  onMount(() => {
    const handleRightClick = (event) => {
      event.preventDefault(); // quick fix

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const [newReal, newImag] = pixel_to_complex(
        x, 
        y, 
        mouseWheelDelta(), 
        centerX(), 
        centerY()
      );
      
      // update both TOGETHER
      batch(() => {
        setCenterX(newReal);
        setCenterY(newImag);
      });
      
    };
    const mainContainer = document.querySelector('.w-full.h-screen');
    if (mainContainer) {
      mainContainer.addEventListener('contextmenu', handleRightClick);
      
      // for good practise
      onCleanup(() => {
        mainContainer.removeEventListener('contextmenu', handleRightClick);
      });
    }
  });

  const setCounterCapped = (value) => {
    setCounter(Math.max(1, Math.min(value, 11)));
  };

  
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
  const changeColourScheme = (scheme) => {
    console.log('🎨 Color scheme hovered:', scheme);
    

    if (colorSchemeTimeout) {
      clearTimeout(colorSchemeTimeout);
    }
    
    colorSchemeTimeout = setTimeout(() => {
      setColourScheme(scheme);
      sendColorSetting(scheme); 
    }, 50);
  };

  const sendColorSetting = (scheme) => {
    const laptopWs = laptopWebsocket();
    if (laptopWs?.readyState === WebSocket.OPEN) {
      const settings = {
        colormap: scheme
      };
      try {
        laptopWs.send(JSON.stringify(settings));
      } catch (error) {
        console.error('cannot send colourmap:', error);
      }
    } else {
      console.warn('no connection!!!');
    }
  };

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


  onMount(() => {
    const handleKeyPress = (event) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true'
      );
      
      if (!isTyping && event.key.toLowerCase() === 'j') {
        const newValue = isJulia() === 0 ? 1 : 0;
        setIsJulia(newValue);
        console.log(`🔄 Julia mode toggled: ${newValue === 1 ? 'ON' : 'OFF'}`);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyPress);
    });
  });

  onMount(() => {
    // UI to FPGA
    const fpgaWs = new WebSocket('ws://192.168.137.92:8080');
    
    fpgaWs.onopen = () => {
        console.log('🔧 Connected to FPGA parameter server!');
        setWebsocket(fpgaWs);
    };
    
    fpgaWs.onerror = (error) => console.error('FPGA WebSocket error:', error);
    fpgaWs.onclose = () => console.log('FPGA parameter connection closed');

    // Python to UI
    const laptopWs = new WebSocket('ws://localhost:8001');
    
    laptopWs.onopen = () => {
        console.log('colouring server connection established');
        setLaptopWebsocket(laptopWs);
    };

    laptopWs.onmessage = (event) => {
        if (event.data instanceof Blob) {
            const url = URL.createObjectURL(event.data);
            setMandelbrotImage(url);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
    };
    
    // webcam to UI
    const connectToGesture = () => {
        const gestureWs = new WebSocket('ws://localhost:8003');
        
        gestureWs.onopen = () => {
            console.log('camera is connected - ping to check');
            
            gestureWs.send(JSON.stringify({ type: 'ping' }));
        };

        gestureWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'gesture_zoom') {
                    setMouseWheelDelta(data.zoom);
                } else if (data.type === 'connection_status') {
                    console.log('status:', data.message);
                } else if (data.type === 'pong') {
                    console.log('acknowledgment successful');
                }
            } catch (e) {
                console.error('error parsing/recieving data:', e);
            }
        };
        
        gestureWs.onerror = (error) => {
            console.error('gesture websocket error:', error);
        };
        
        gestureWs.onclose = (event) => {
            console.log('gesture connection closed:', event.code, event.reason);
        };
        
        return gestureWs;
    };
    
    const gestureWs = connectToGesture();

    onCleanup(() => {
        fpgaWs?.close();
        laptopWs?.close();
        gestureWs?.close();
    });
  });

  createEffect(() => {
    const ws = websocket(); 
    if (ws?.readyState === WebSocket.OPEN) {
      let params;
      
      if (isJulia() === 1) {
        params = {
          re_c: 0.0,           
          im_c: 0.0,           
          zoom: mouseWheelDelta(),
          max_iter: counter(),
          is_julia: 1,
          julia_re: centerX(), 
          julia_im: centerY() 
        };
      } else {
        params = {
          re_c: centerX(),
          im_c: centerY(),
          zoom: mouseWheelDelta(),
          max_iter: counter(),
          is_julia: 0
          // colour_sch: colourScheme() (will be handled in .py program)
        };
      }
      // for (let i = 0; i < 2; i++){
      //   ws.send(JSON.stringify(params));
      // }

      ws.send(JSON.stringify(params));
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

  const regionDefinitions = {
    seahorse: {
      centerX: -0.74,
      centerY: 0.13,
      zoom: 7,
      tolerance: 0.05,
      name: 'seahorse',
      displayName: () => t('seahorse')
    },
    spiralArms: {
      centerX: -0.15,
      centerY: 0.85,
      zoom: 5,
      tolerance: 0.08,
      name: 'spiralArms',
      displayName: () => t('spiral_arms')
    },
    minibrot: {
      centerX: -0.235125,
      centerY: 0.827215,
      zoom: 10,
      tolerance: 0.03,
      name: 'minibrot',
      displayName: () => t('minibrot')
    },
    scepter: {
      centerX: -1.25,
      centerY: 0.02,
      zoom: 8,
      tolerance: 0.06,
      name: 'scepter',
      displayName: () => t('scepter')
    },
    tripleSpiral: {
      centerX: -0.11,
      centerY: 0.75,
      zoom: 6,
      tolerance: 0.07,
      name: 'tripleSpiral',
      displayName: () => t('tripleSpiral')
    }
  };

  const getCurrentRegion = createMemo(() => {
    const currentX = centerX();
    const currentY = centerY();
    const currentZoom = mouseWheelDelta();
    
    for (const [key, region] of Object.entries(regionDefinitions)) {
      const distanceX = Math.abs(currentX - region.centerX);
      const distanceY = Math.abs(currentY - region.centerY);
      const zoomDiff = Math.abs(currentZoom - region.zoom);
      
      if (distanceX <= region.tolerance && 
          distanceY <= region.tolerance && 
          zoomDiff <= 2) {
        return region;
      }
    }
    return null;
  });

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
          
          {getCurrentRegion() && (
            <div 
              class={`absolute bottom-5 right-5 w-12 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
                !isDarkMode() ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-gray-800 hover:bg-gray-900 text-white'
              }`}
              style={{ "z-index": "15" }}
            >
              <button
                onClick={() => toggleModal(getCurrentRegion().name, true)}
                class="w-full h-full flex items-center justify-center focus:outline-none rounded-full"
                title={getCurrentRegion().displayName()} // Tooltip on hover
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          )}
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
      {/*Region modals*/}
      <Modal 
        title={t('seahorse')}
        content={
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('seahorse_description')}
            </div>
            <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                <div>Center: (-0.74, 0.13)</div>
                <div>Zoom: 7</div>
              </div>
            </div>
          </div>
        }
        isOpen={() => modals().seahorse} 
        onClose={() => toggleModal('seahorse', false)} 
      />

      <Modal 
        title={t('spiral_arms')}
        content={
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('spiral_arms_description')}
            </div>
            <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                <div>Center: (-0.15, 0.85)</div>
                <div>Zoom: 5</div>
              </div>
            </div>
          </div>
        }
        isOpen={() => modals().spiralArms} 
        onClose={() => toggleModal('spiralArms', false)} 
      />

      <Modal 
        title={t('minibrot')}
        content={
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('minibrot_description')}
            </div>
            <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                <div>Center: (-0.235125, 0.827215)</div>
                <div>Zoom: 10</div>
              </div>
            </div>
          </div>
        }
        isOpen={() => modals().minibrot} 
        onClose={() => toggleModal('minibrot', false)} 
      />

      <Modal 
        title={t('scepter')}
        content={
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('scepter_description')}
            </div>
            <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                <div>Center: (-1.25, 0.02)</div>
                <div>Zoom: 8</div>
              </div>
            </div>
          </div>
        }
        isOpen={() => modals().scepter} 
        onClose={() => toggleModal('scepter', false)} 
      />

      <Modal 
        title={t('tripleSpiral')}
        content={
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('triple_spiral_description')}
            </div>
            <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                <div>Center: (-0.11, 0.75)</div>
                <div>Zoom: 6</div>
              </div>
            </div>
          </div>
        }
        isOpen={() => modals().tripleSpiral} 
        onClose={() => toggleModal('tripleSpiral', false)} 
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