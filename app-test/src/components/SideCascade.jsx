import { createSignal } from 'solid-js';
import Button from './Button.jsx'

export default function SideCascade (props) {
    const [isSide, setIsSide] = createSignal(false);

    const handleMainButtonClick = () => {
        if (props.showNumbers && props.onMinusOne) {
            props.onMinusOne();
        }
    };

    const handleDarkModeToggle = () => {
        if (props.setIsDarkMode) {
            const newValue = !props.isDarkMode;
            props.setIsDarkMode(newValue);
        }
    };

    const handleMouseEnter = () => {
        setIsSide(true);
    };

    const handleMouseLeave = () => {
        setIsSide(false);
    };

    return (
        <div 
            class="flex flex-row gap-2"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Button onClick={handleMainButtonClick}>
                { props.showNumbers ? "+3" : (
                    <svg width="20" height="20" data-slot="icon" aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                )}
            </Button>

            <div 
                class="flex flex-col gap-2 overflow-hidden transition-all duration-700 ease-in-out origin-top"
                style={{
                  "opacity": isSide() ? "1" : "0",
                  "transform": isSide() ? "scaleY(1)" : "scaleY(0)",
                  "max-height": isSide() ? "200px" : "0px",
                  "margin-top": isSide() ? "0" : "-8px"
                }}
            >
                <Button onClick={handleDarkModeToggle}>
                    <svg width="20" height="20" data-slot="icon" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path clip-rule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" fill-rule="evenodd"></path>
                    </svg>
                </Button>
                <Button onClick={() => props.setIsConfigModal(true)}>
                    <svg width="20" height="20" data-slot="icon" aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.745 3A23.933 23.933 0 0 0 3 12c0 3.183.62 6.22 1.745 9M19.5 3c.967 2.78 1.5 5.817 1.5 9s-.533 6.22-1.5 9M8.25 8.885l1.444-.89a.75.75 0 0 1 1.105.402l2.402 7.206a.75.75 0 0 0 1.104.401l1.445-.889m-8.25.75.213.09a1.687 1.687 0 0 0 2.062-.617l4.50-6.676a1.688 1.688 0 0 1 2.062-.618l.213.09" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </Button>
                <Button onClick={() => props.setIsModalOpen(true)}>
                    <svg width="20" height="20" data-slot="icon" aria-hidden="true" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </Button>
              </div>
        </div>
    );
}