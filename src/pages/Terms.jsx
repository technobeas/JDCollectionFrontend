import SEO from "../components/SEO";
export default function Terms() {
  return (
    <div className="container-app py-10">
      <SEO
        title="Terms & Conditions | JD COLLECTION"
        description="Terms and conditions for using the JD COLLECTION website."
      />
      <article className="prose max-w-3xl">
        <h1>Terms & Conditions</h1>
        <p>
          Welcome to JD COLLECTION. This website is a product catalogue for
          viewing products, offers and shop information. It does not provide
          online delivery or checkout.
        </p>
        <h2>Product information</h2>
        <p>
          Prices, availability, images, colors, sizes and offers may change.
          Please confirm product details with the shop before purchase.
        </p>
        <h2>Purchases</h2>
        <p>
          Purchases are completed at the physical shop. Website listings do not
          constitute a guarantee that an item will remain available.
        </p>
        <h2>Website use</h2>
        <p>
          Please use the website lawfully and do not attempt to disrupt, abuse
          or gain unauthorized access to the service.
        </p>
        <h2>Changes</h2>
        <p>
          We may update these terms when the website or shop services change.
        </p>
      </article>
    </div>
  );
}
