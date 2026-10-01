const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../shared/theme/Default/src/**/*.{js,ts,jsx,tsx}",
    "../../modules/virtual-computer/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        raised: v("raised"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        faint: v("faint"),
        overlay: v("overlay"),
        accent: v("accent"),
        "accent-2": v("accent-2"),
        "accent-strong": v("accent-strong"),
        "accent-ink": v("accent-ink"),
        success: v("success"),
        warn: v("warn"),
        danger: v("danger"),
        info: v("info"),
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
};
