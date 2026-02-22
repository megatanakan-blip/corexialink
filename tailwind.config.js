/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    blue: {
                        DEFAULT: '#005c9c', // Core Blue
                        light: '#00a3e0',
                        dark: '#003462',
                    },
                    green: {
                        DEFAULT: '#059669', // Lite Green
                        light: '#34d399',
                        dark: '#065f46',
                    },
                }
            },
            fontFamily: {
                sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
