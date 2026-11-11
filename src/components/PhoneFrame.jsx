export default function PhoneFrame({ children, className = '', height = 620 }) {
  return (
    <div className={`relative mx-auto w-full max-w-[320px] rounded-[46px] bg-ink p-[10px] shadow-lift ${className}`}>
      <div className="absolute top-[18px] left-1/2 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-ink" />
      <div className="scrollbar-none relative overflow-y-auto overscroll-contain rounded-[36px] bg-white" style={{ height, clipPath: 'inset(0 round 36px)' }}>
        {children}
      </div>
    </div>
  )
}
