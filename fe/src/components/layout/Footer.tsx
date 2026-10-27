export function Footer({ siteName }: { siteName: string }) {
  return (
    <footer className="mx-auto mt-20 max-w-measure px-4">
      <p className="border-t border-border py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} {siteName}
      </p>
    </footer>
  );
}
