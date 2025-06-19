import { createSignal } from 'solid-js';
import Button from './Button.jsx'

export default function CascadeButton (props){
  const [isHovered, setIsHovered] = createSignal(false);

  const handleMouseEnter = () => {
    if (!props.showNumbers) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!props.showNumbers) {
      setIsHovered(false);
    }
  };

  const handleClick = () => {
    if (props.showNumbers && props.onMinusOne) {
      props.onMinusOne();
    }
  };

  const handleColourHover = (colourScheme) => {
  if (props.onSchemeChange && !props.showNumbers) {
      props.onSchemeChange(colourScheme);
    } 
  };

  return (
    <div 
      class="flex flex-row gap-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button onClick={handleClick} isDarkMode={props.isDarkMode}>
        {props.showNumbers ? "-1" : (
          <svg width="20" height="20" data-slot="icon" aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="m15 11.25 1.5 1.5.75-.75V8.758l2.276-.61a3 3 0 1 0-3.675-3.675l-.61 2.277H12l-.75.75 1.5 1.5M15 11.25l-8.47 8.47c-.34.34-.8.53-1.28.53s-.94.19-1.28.53l-.97.97-.75-.75.97-.97c.34-.34.53-.8.53-1.28s.19-.94.53-1.28L12.75 9M15 11.25 12.75 9" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        )}
      </Button>
      
      <div 
        class="flex flex-row gap-2 overflow-hidden transition-all duration-500 ease-in-out origin-left"
        style={{
          "opacity": (isHovered() && !props.showNumbers) ? "1" : "0",
          "transform": (isHovered() && !props.showNumbers) ? "scaleX(1)" : "scaleX(0)",
          "max-width": (isHovered() && !props.showNumbers) ? "250px" : "0px",
          "margin-left": (isHovered() && !props.showNumbers) ? "4px" : "0px"
        }}
      >
        <Button 
          customClass="bg-radial-[at_25%_25%] from-white to-zinc-900 to-66% hover:brightness-75 transition-all duration-200"
          isDarkMode={props.isDarkMode}
          onMouseEnter={() => handleColourHover('grayscale')}
        >
        </Button>
        <Button
          customClass="bg-radial-[at_65%_25%] from-orange-300 via-blue-500 to-indigo-500 to-90% hover:brightness-75 transition-all duration-200"
          isDarkMode={props.isDarkMode}
          onMouseEnter={() => handleColourHover('classic')}
        >
        </Button>
        <Button
          customClass="bg-radial-[at_10%_85%] from-purple-800 via-orange-500 to-orange-300 to-90% hover:brightness-75 transition-all duration-200"
          isDarkMode={props.isDarkMode}
          onMouseEnter={() => handleColourHover('sunset')}
        >
        </Button>
        <Button
          customClass="bg-radial-[at_50%_50%] from-black to-green-600 hover:brightness-75 transition-all duration-200"
          isDarkMode={props.isDarkMode}
          onMouseEnter={() => handleColourHover('neon_green')}
        >
        </Button>
      </div>
    </div>
  );
}