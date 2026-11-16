/** Server Component estático — evita hooks de i18n no prerender de /_not-found. */
export default function NotFound() {
  return (
    <main className="vj-page" id="conteudo">
      <h1 className="vj-title">Não encontramos esta página.</h1>
      <p>O endereço não corresponde a uma área desta versão. A navegação continua disponível.</p>
      <a className="vj-button vj-button-primary" href="/">
        Voltar ao início
      </a>
    </main>
  );
}
