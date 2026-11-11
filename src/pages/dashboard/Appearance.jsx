import { Check } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import ImageInput from '../../components/ImageInput'
import { Card, InfoButton, Input, Select, Toggle } from '../../components/ui'
import { LANGUAGES } from '../../lib/i18n'
import { backgroundCss, buttonCss, FONTS, PRESETS, resolveTheme } from '../../lib/themes'
import { PageHeading } from './DashboardLayout'
import { useOwnerFeatures } from '../../lib/usePlan'
import PreviewPane from './PreviewPane'

function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream p-2 pr-3">
      <span className="relative size-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-ink/10" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={label} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs text-ink-500">{label} <InfoButton label={label} /></span>
        <span className="block font-mono text-sm font-semibold uppercase">{value}</span>
      </span>
    </label>
  )
}

function Choice({ active, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border-2 p-3 text-sm font-semibold transition ${active ? 'border-ink bg-white' : 'border-transparent bg-cream hover:border-ink/20'} ${className}`}>
      {children}
    </button>
  )
}

export default function Appearance() {
  const { page, updatePage } = usePage()
  const features = useOwnerFeatures(page.owner_id)
  const theme = resolveTheme(page.theme)
  const setTheme = (patch) => updatePage({ theme: { ...page.theme, ...patch } })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4 pb-20 xl:pb-0">
        <PageHeading title="Design." italic="Make it yours.">Layout, pictures, colours, fonts and buttons.</PageHeading>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Themes</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(PRESETS).map(([key, p]) => {
              const active = (page.theme?.preset || 'cream') === key
              return (
                <button key={key} type="button" onClick={() => updatePage({ theme: { preset: key, layout: theme.layout, cover: theme.cover, tagline: theme.tagline } })} className={`group relative overflow-hidden rounded-2xl p-1 transition ${active ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10 hover:ring-ink/30'}`}>
                  <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl px-3" style={{ background: backgroundCss(p), color: p.text }}>
                    <span className="mb-1 size-7 rounded-full" style={{ background: p.accent }} />
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-3.5 w-full" style={{ ...buttonCss(p), borderWidth: 1.5, boxShadow: 'none' }} />
                    ))}
                  </div>
                  <span className="flex items-center justify-center gap-1 py-2 text-sm font-semibold">
                    {active && <Check className="size-3.5" />} {p.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Layout</h2>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[['classic', 'Centered'], ['hero', 'Full photo'], ['banner', 'Banner + photo'], ['left', 'Text + picture'], ['poster', 'Big name'], ['card', 'Floating panel']].map(([v, l]) => (
              <Choice key={v} active={(theme.layout || 'classic') === v} onClick={() => setTheme({ layout: v })}>{l}</Choice>
            ))}
          </div>
          {['hero', 'banner', 'left'].includes(theme.layout) && (
            <div className="mt-4">
              <ImageInput label="Cover photo" value={theme.cover} onChange={(cover) => setTheme({ cover })} folder="covers" />
            </div>
          )}
          <div className="mt-4">
            <Input label="Trust line (optional)" maxLength={50} placeholder="2 lakh followers · 40+ brand collabs" value={theme.tagline || ''} onChange={(e) => setTheme({ tagline: e.target.value })} />
          </div>
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Background</h2>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']].map(([v, l]) => (
              <Choice key={v} active={theme.bgType === v} onClick={() => setTheme({ bgType: v })}>{l}</Choice>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {theme.bgType !== 'image' && <ColorInput label={theme.bgType === 'gradient' ? 'Top colour' : 'Background'} value={theme.bg} onChange={(bg) => setTheme({ bg })} />}
            {theme.bgType === 'gradient' && <ColorInput label="Bottom colour" value={theme.bg2 || theme.bg} onChange={(bg2) => setTheme({ bg2 })} />}
            <ColorInput label="Text" value={theme.text} onChange={(text) => setTheme({ text })} />
            <ColorInput label="Accent" value={theme.accent} onChange={(accent) => setTheme({ accent })} />
          </div>
          {theme.bgType === 'image' && (
            <div className="mt-4">
              <ImageInput label="Background image" value={theme.bgImage} onChange={(bgImage) => setTheme({ bgImage })} folder="backgrounds" />
              <label className="mt-4 block text-sm font-medium text-ink-700">
                Darken picture so text stays readable
                <input type="range" min="0" max="0.8" step="0.05" className="mt-2 w-full accent-ink" value={theme.bgDim ?? 0.25} onChange={(e) => setTheme({ bgDim: Number(e.target.value) })} />
              </label>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Buttons</h2>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['fill', 'Filled'], ['outline', 'Outline'], ['soft', 'Soft'], ['shadow', 'Hard shadow']].map(([v, l]) => (
              <Choice key={v} active={theme.buttonStyle === v} onClick={() => setTheme({ buttonStyle: v })}>
                <span className="mb-2 block h-7 w-full" style={{ ...buttonCss({ ...theme, buttonStyle: v }), boxShadow: v === 'shadow' ? `3px 3px 0 ${theme.text}` : undefined }} />
                {l}
              </Choice>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']].map(([v, l]) => (
              <Choice key={v} active={theme.radius === v} onClick={() => setTheme({ radius: v })}>{l}</Choice>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ColorInput label="Button colour" value={theme.buttonBg} onChange={(buttonBg) => setTheme({ buttonBg })} />
            <ColorInput label="Button text" value={theme.buttonText} onChange={(buttonText) => setTheme({ buttonText })} />
          </div>
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Fonts & language</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Select label="Heading font" value={theme.headingFont} onChange={(e) => setTheme({ headingFont: e.target.value })} options={Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }))} />
            <Select label="Body font" value={theme.font} onChange={(e) => setTheme({ font: e.target.value })} options={Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }))} />
            <Select label="Page language" hint="Translates buttons like Share and Register for visitors" value={page.language} onChange={(e) => updatePage({ language: e.target.value })} options={LANGUAGES} />
          </div>
        </Card>

        <Card className="p-5 sm:p-7">
          <Toggle
            label="Show “Made with” badge"
            description={features?.remove_branding ? 'Your plan lets you remove it.' : 'Removing branding is part of Pro. It helps other creators find us.'}
            checked={page.show_branding}
            disabled={!features?.remove_branding}
            onChange={(show_branding) => updatePage({ show_branding }, { immediate: true })}
          />
        </Card>
      </div>
      <PreviewPane />
    </div>
  )
}
