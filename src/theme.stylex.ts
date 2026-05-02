import * as stylex from '@stylexjs/stylex'

const DARK = '@media (prefers-color-scheme: dark)'

export const colors = stylex.defineVars({
  text: { default: '#6b6375', [DARK]: '#9ca3af' },
  textH: { default: '#08060d', [DARK]: '#f3f4f6' },
  bg: { default: '#fff', [DARK]: '#16171d' },
  border: { default: '#e5e4e7', [DARK]: '#2e303a' },
  codeBg: { default: '#f4f3ec', [DARK]: '#1f2028' },
  accent: { default: '#aa3bff', [DARK]: '#c084fc' },
  accentBg: { default: 'rgba(170, 59, 255, 0.1)', [DARK]: 'rgba(192, 132, 252, 0.15)' },
  accentBorder: { default: 'rgba(170, 59, 255, 0.5)', [DARK]: 'rgba(192, 132, 252, 0.5)' },
  socialBg: { default: 'rgba(244, 243, 236, 0.5)', [DARK]: 'rgba(47, 48, 58, 0.5)' },
  shadow: {
    default: 'rgba(0, 0, 0, 0.1) 0 10px 15px -3px, rgba(0, 0, 0, 0.05) 0 4px 6px -2px',
    [DARK]: 'rgba(0, 0, 0, 0.4) 0 10px 15px -3px, rgba(0, 0, 0, 0.25) 0 4px 6px -2px'
  }
})

export const fonts = stylex.defineVars({
  sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
  heading: "system-ui, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, Consolas, monospace",
})
