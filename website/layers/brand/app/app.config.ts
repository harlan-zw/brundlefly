export default defineAppConfig({
  ui: {
    colors: { primary: 'amber', neutral: 'stone' },
    button: {
      slots: { base: 'font-mono min-h-11 rounded-none px-5 py-3 cursor-pointer font-medium transition duration-150' },
      defaultVariants: { variant: 'solid', size: 'lg' },
    },
    input: { slots: { base: 'min-h-11 rounded-none font-mono' } },
    textarea: { slots: { base: 'rounded-none font-mono text-base leading-relaxed' } },
  },
})
