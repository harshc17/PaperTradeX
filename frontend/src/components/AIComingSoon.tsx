export default function AIComingSoon({ title }: { title: string }) {
    return <section className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="break-words text-base font-semibold text-ink-heading">{title}</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-primary">Coming soon!</p>
    </section>;
}
