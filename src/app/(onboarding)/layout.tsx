export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function OnboardingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">{children}</div>;
}
