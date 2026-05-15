const links = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "/about" },
  { id: "docs", label: "Docs", href: "/docs" },
];

export function App() {
  const active = "home";

  return (
    <>
      <nav className="nav">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            className={
              active === link.id ? "nav-link nav-link--active" : "nav-link"
            }
          >
            {link.label}
          </a>
        ))}
      </nav>
      <section className="container">
        <h1 className="hero-title">Welcome to the Testbed</h1>
        <p className="hero-body">
          This testbed verifies the full editing pipeline with CSS variables,
          expression attributes, and scoped styles.
        </p>
      </section>
    </>
  );
}
