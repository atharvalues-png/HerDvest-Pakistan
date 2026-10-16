import { ButtonLink, Container } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <section className="flex min-h-[80vh] items-center bg-forest-950 pt-24 text-ivory">
      <Container className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">404</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">This page has wandered off.</h1>
        <p className="mx-auto mt-4 max-w-md text-ivory/70">The page you are looking for does not exist or has moved.</p>
        <div className="mt-9 flex justify-center gap-3">
          <ButtonLink href="/" variant="gold" arrow>
            Back to home
          </ButtonLink>
          <ButtonLink href="/contact" variant="outline-light">
            Contact us
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
