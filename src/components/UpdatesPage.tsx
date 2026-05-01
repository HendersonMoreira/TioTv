const WHATSAPP_LINK = 'https://wa.me/5521997932962?text=Ola%2C+vim+pela+pagina+de+atualizacoes+do+TioTV+e+quero+falar+sobre+pagamento.';
const APK_DOWNLOAD_LINK = 'https://drive.google.com/drive/folders/1j4fzVSJ6XiKl-hgh4ZKo-7olAcszy1zz?usp=sharing';

export function UpdatesPage() {
  return (
    <main className="updates-page">
      <section className="updates-card">
        <p className="updates-badge">Atualizacao Oficial</p>
        <h2>Estamos evoluindo o TioTV</h2>

        <p>
          O projeto ja esta em uma fase muito boa, com aplicativo em funcionamento e melhorias chegando toda semana.
          Obrigado de coracao para todo mundo que ja esta com a gente e ajudando o projeto a crescer.
        </p>

        <p>
          Ja temos versao de aplicativo e eu estou desenvolvendo tudo com muito cuidado para ficar bonito,
          pratico e rapido para assistir.
        </p>

        <ul className="updates-list">
          <li>Aplicativo para TV em desenvolvimento e evolucao constante.</li>
          <li>Aplicativo para celular com foco em experiencia simples e moderna.</li>
          <li>Suporte direto comigo para falar sobre pagamento e acesso.</li>
        </ul>

        <div className="updates-contact">
          <p>
            Para falar comigo sobre pagamento, me chama no WhatsApp:
            <strong> 21 99793-2962</strong>
          </p>
          <div className="updates-contact-actions">
            <a
              className="updates-whatsapp-btn"
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
            <a
              className="updates-whatsapp-btn updates-download-btn"
              href={APK_DOWNLOAD_LINK}
              target="_blank"
              rel="noreferrer"
            >
              dowloand do apk celular e tv
            </a>
          </div>
        </div>

        <p className="updates-footer-note">
          Obrigado por acreditar no projeto. Vem muita novidade boa por ai.
        </p>

        <section className="updates-plans" aria-label="Planos do TioTV">
          <article className="updates-plan-card">
            <p className="updates-plan-tag">Premium</p>
            <h3>R$ 9,99</h3>
            <p className="updates-plan-sub">acesso mensal</p>
            <ul>
              <li>Animes</li>
              <li>Filmes</li>
              <li>Series</li>
            </ul>
          </article>

          <article className="updates-plan-card updates-plan-card-plus">
            <p className="updates-plan-tag">Premium Plus</p>
            <h3>R$ 15,90</h3>
            <p className="updates-plan-sub">acesso mensal</p>
            <ul>
              <li>Futebol Aberto</li>
              <li>Canais Premiere</li>
              <li>Canais especiais ao vivo</li>
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
