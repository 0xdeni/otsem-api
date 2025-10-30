// src/mail/templates/password-reset.html.ts
export function passwordResetHtml(params: {
    resetUrl: string;
    productName?: string; // ex.: "Otsem Bank"
}): string {
    const { resetUrl, productName = "Otsem Bank" } = params;
    const year = new Date().getFullYear();

    return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Redefinição de senha</title>
  <style>
    /* Reset base */
    body{margin:0;padding:0;background:#f6f7fb;color:#0f172a}
    a{color:#4f46e5;text-decoration:none}
    img{border:0;outline:none}
    /* Container */
    .wrap{max-width:600px;margin:0 auto;padding:24px}
    .card{background:#ffffff;border-radius:16px;box-shadow:0 6px 20px rgba(2,6,23,.06);overflow:hidden}
    .header{padding:24px;border-bottom:1px solid #eef2ff;background:linear-gradient(180deg,#eef2ff, #fff)}
    .logo{font:700 18px/1.2 system-ui, -apple-system, Segoe UI, Roboto; color:#4f46e5;}
    .content{padding:24px}
    .title{font:600 20px/1.3 system-ui, -apple-system, Segoe UI, Roboto; margin:0 0 8px}
    .muted{color:#475569;font:400 14px/1.6 system-ui, -apple-system, Segoe UI, Roboto;margin:0 0 16px}
    .btn{display:inline-block;background:#4f46e5;color:#fff;font:600 15px/1 system-ui,-apple-system,Segoe UI,Roboto;padding:14px 20px;border-radius:10px}
    .btn:hover{background:#4338ca}
    .link{word-break:break-all;font:400 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,"Liberation Mono","Courier New", monospace}
    .footer{padding:16px 24px;color:#64748b;font:400 12px/1.6 system-ui,-apple-system,Segoe UI,Roboto}
    .divider{height:1px;background:#eef2ff;margin:24px 0}
    @media (prefers-color-scheme: dark){
      body{background:#0b1220;color:#e2e8f0}
      .card{background:#0f172a;box-shadow:0 6px 20px rgba(0,0,0,.4)}
      .header{border-bottom-color:#1e293b;background:linear-gradient(180deg,#121a2b, #0f172a)}
      .muted{color:#94a3b8}
      .footer{color:#94a3b8}
      .divider{background:#1e293b}
    }
    @media (max-width:480px){
      .wrap{padding:12px}
      .content{padding:20px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div class="logo">${productName}</div>
      </div>
      <div class="content">
        <h1 class="title">Redefinição de senha</h1>
        <p class="muted">
          Recebemos uma solicitação para redefinir a sua senha do <strong>${productName}</strong>.
          O link abaixo é válido por <strong>30 minutos</strong>.
        </p>

        <p style="margin:0 0 20px">
          <a class="btn" href="${resetUrl}" target="_blank" rel="noopener">Criar nova senha</a>
        </p>

        <p class="muted" style="margin-top:0">
          Se o botão não funcionar, copie e cole este link no navegador:
        </p>
        <p class="link">${resetUrl}</p>

        <div class="divider"></div>

        <p class="muted" style="margin:0">
          Caso você não tenha solicitado, pode ignorar este e-mail. Sua conta permanece segura.
        </p>
      </div>
      <div class="footer">
        © ${year} ${productName}. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
`;
}
