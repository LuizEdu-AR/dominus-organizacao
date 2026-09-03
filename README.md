# Dominus — Organização

Versão inicial do painel administrativo da Dominus em React + Vite, preparada para GitHub, Vercel e Firebase.

## Stack

- React.js + Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK nas funções `/api`
- Vercel
- Discord Webhooks

## Estrutura

```text
/
├── api/
│   ├── _firebaseAdmin.js
│   ├── discord-service.js
│   └── user-admin.js
├── public/
│   └── images/
│       └── dominus-logo.png
├── src/
│   ├── components/
│   │   ├── modais/
│   │   ├── navegacao/
│   │   ├── toasts/
│   │   └── ui/
│   ├── context/
│   ├── data/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── scripts/
├── firestore.rules
├── package.json
├── vercel.json
└── .env.example
```

## Funcionalidades desta versão

- Login e cadastro por ID + senha
- ID convertido internamente em e-mail técnico do Firebase Auth (`id@dominus.local`)
- Novos usuários entram como `pending`
- Liberação de acesso por Líder/Gerente
- Alteração de cargos por Líder
- Demissão excluindo Firebase Auth + Firestore através de API segura
- Hierarquia e envio para Discord
- Tabela de preços editável por Líder
- Valores iniciais provisórios já preparados
- Registradora com PISTA/PARCERIA, desconto, taxa e resumo
- Registro de venda no Firestore + Discord
- Histórico de vendas com paginação e exclusão pela gestão
- Farm + registro no Firestore + Discord
- Histórico de farm com paginação
- Quadro de avisos
- Meu Perfil (nome e senha editáveis, ID bloqueado)
- Tema escuro preto/roxo/dourado/branco

## Configuração Firebase

1. Crie um projeto no Firebase.
2. Ative **Authentication > Email/Password**.
3. Crie o **Cloud Firestore**.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variáveis `VITE_FIREBASE_*`.
6. Crie uma conta de serviço do Firebase Admin e configure:
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
7. Publique `firestore.rules` pelo Firebase Console ou Firebase CLI.

## Líderes Chico e Aron

As contas são criadas pelo script sem deixar senha fixa dentro do repositório.

Defina:

```env
CHICO_ID=
CHICO_PASSWORD=
ARON_ID=
ARON_PASSWORD=
```

Depois execute:

```bash
npm run seed:admins
```

## Produtos iniciais

Depois de configurar o Firebase Admin:

```bash
npm run seed:firebase
```

Também existe um botão **Carregar valores iniciais** na Tabela de Preços quando um Líder entra e a coleção ainda está vazia.

Os valores atuais são provisórios e a regra de parceria começa desativada, conforme solicitado.

## Farm

Os 8 itens estão com nomes provisórios (`Item de Farm 01` etc.) porque os nomes oficiais ainda não foram confirmados. Basta alterar `src/data/farmItems.js` quando a lista correta for informada.

## Discord

Configure na Vercel:

```env
DISCORD_SALES_WEBHOOK=
DISCORD_FARM_WEBHOOK=
DISCORD_HIERARCHY_WEBHOOK=
```

A logo pode ficar no próprio projeto em:

```text
/public/images/dominus-logo.png
```

O endpoint tenta gerar a URL pública automaticamente. Se preferir, configure `DOMINUS_LOGO_URL` com a URL final da imagem hospedada na Vercel.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub + Vercel

1. Crie um repositório no GitHub.
2. Envie os arquivos deste projeto.
3. Na Vercel, importe o repositório.
4. Cadastre as variáveis de ambiente.
5. Deploy.

> Nunca envie `.env` ou `.env.local` ao GitHub.
