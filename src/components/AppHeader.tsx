import salusLogo from "../assets/salus-logo.svg";

export default function AppHeader() {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-800 px-5 py-4">
      <img src={salusLogo} alt="" className="size-9 shrink-0 object-contain" />
      <h1 className="-translate-y-[2px] font-brand text-3xl leading-none text-[#7b7878]">SALUS</h1>
    </header>
  );
}
