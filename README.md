# Dominus — Organização

Painel administrativo da **Dominus**, desenvolvido em React + Vite e integrado ao Firebase, Vercel, Discord e Cloudinary.

## Stack

- React.js + Vite
- React Router
- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK nas funções `/api`
- Vercel
- Discord Webhooks
- Cloudinary para armazenamento de imagens

## Estrutura principal

```text
/
├── api/
│   ├── _firebaseAdmin.js
│   ├── cleanup-cloudinary.js
│   ├── discord-service.js
│   ├── upload-image.js
│   └── user-admin.js
├── public/
│   └── images/
│       ├── dominus-logo.png
│       └── farm/
├── src/
│   ├── components/
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

## Funcionalidades

### Autenticação e usuários

- Login e cadastro por ID + senha
- ID convertido internamente em e-mail técnico do Firebase Auth
- Novos usuários entram como `pending`
- Aprovação de novos membros por Líder/Gerência
- Alteração de cargos por Líder
- Gerentes não podem demitir Líderes
- Demissão remove a conta através de API administrativa segura
- Perfil com alteração de nome e senha
- Controle de acesso conforme cargo

### Hierarquia

Cargos disponíveis:

- Líder
- Gerente Geral
- Gerente de Ações
- Gerente de Parcerias
- Gerente de Finanças
- Membro

A hierarquia pode ser enviada ao Discord através de webhook e é exibida separada por cargos.

### Tabela de preços

- Produtos separados por categoria
- Preço de pista
- Ativação de parceria por produto
- Preço de parceria
- Cadastro e exclusão de produtos por Líder
- Taxa da facção configurável
- Um único botão para salvar todas as alterações da tabela
- Reordenação dos produtos por arrastar e soltar
- A ordem dos produtos é persistida no Firestore através do campo `order`

### Registradora

- Venda do tipo **Pista** ou **Parceria**
- Quantidade digitável e controles `+` / `-`
- Valores carregados diretamente da Tabela de Preços
- Usuário não pode alterar manualmente o preço durante a venda
- Cálculo automático de desconto e taxa da facção
- Registro no Firestore
- Envio automático para o Discord
- Suporte a webhook principal e webhook secundário de vendas
- Loading durante o envio para evitar registros duplicados

### Histórico de vendas

- Consulta dos registros de vendas
- Informações do vendedor, itens, tipo e valores
- Paginação
- Exclusão disponível para a gestão

### Farm

Itens oficiais:

1. Pano
2. Chip
3. Ferro de Solda
4. Aço
5. Plástico Processado
6. Materiais Reciclados
7. Cabo
8. Cinta
9. Borracha Processada
10. Fibra de Carbono
11. Transponder
12. Alumínio Chapado
13. Módulo ECU
14. Cobre Escovado

Funcionalidades:

- Imagem própria para cada item na interface
- Quantidade digitável e controles `+` / `-`
- Comprovante de imagem obrigatório
- Seleção de arquivo ou colagem de imagem com **CTRL + V**
- Orientação para capturar apenas os itens no baú pessoal
- Upload do comprovante para o Cloudinary
- URL e `public_id` armazenados junto ao registro
- Registro no Firestore
- Envio do registro e da imagem para o Discord
- Loading durante o envio para evitar registros duplicados

As imagens dos itens da interface ficam em:

```text
/public/images/farm/
```

Os comprovantes enviados pelos usuários ficam no Cloudinary em:

```text
dominus/farm
```

### Histórico de Farm

- Consulta dos registros de Farm
- Paginação
- Exclusão disponível para a gestão
- O histórico permanece no Firestore mesmo após a remoção automática da imagem antiga do Cloudinary

### Registro de Ação

Campos disponíveis:

- Ação
- Data
- Hora
- Resultado
- Resumo
- Motivo
- Participantes
- Foto/Vídeo

O campo **Resumo** inicia com `Opcional` e o campo **Motivo** inicia com `Ação`.

Para mídia:

- Link de foto/vídeo
- Anexo de imagem
- Colagem de imagem com **CTRL + V**
- Upload de imagens para o Cloudinary
- Envio do registro para o Firestore e Discord
- Suporte a webhook principal e webhook secundário de ações

As imagens anexadas aos registros de ação ficam em:

```text
dominus/actions
```

### Quadro de avisos

- Líderes e Gerentes podem publicar avisos
- Membros aprovados podem visualizar os avisos

## Cloudinary

O Cloudinary é utilizado para armazenar os comprovantes de Farm e as imagens anexadas aos Registros de Ação.

Configure no ambiente:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

O `CLOUDINARY_API_SECRET` deve permanecer somente no backend e nunca deve ser exposto no frontend ou enviado ao GitHub.

### Limpeza automática

O projeto possui uma rotina automática para remover do Cloudinary imagens de Farm e Registro de Ação com mais de **30 dias**.

A rotina:

1. Localiza registros antigos.
2. Exclui a imagem correspondente no Cloudinary através do `imagePublicId`.
3. Mantém o registro no Firestore.
4. Remove do registro as referências da imagem que já foi apagada.

Endpoint:

```text
/api/cleanup-cloudinary
```

A execução é protegida por:

```env
CRON_SECRET=
```

O agendamento fica configurado no `vercel.json`.

## Discord

Webhooks utilizados:

```env
DISCORD_SALES_WEBHOOK=
DISCORD_FARM_WEBHOOK=
DISCORD_HIERARCHY_WEBHOOK=
DISCORD_ACTIONS_WEBHOOK=

DISCORD_SALES_WEBHOOK_SECONDARY=
DISCORD_ACTIONS_WEBHOOK_SECONDARY=
```

Vendas e Registros de Ação podem ser enviados simultaneamente para dois servidores/canais diferentes.

A logo dos webhooks pode ser configurada por:

```env
DOMINUS_LOGO_URL=
```

ou utilizada diretamente da aplicação:

```text
/public/images/dominus-logo.png
```

## Firebase

### Configuração

1. Crie/configure o projeto no Firebase.
2. Ative **Authentication > Email/Password**.
3. Crie o **Cloud Firestore**.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variáveis `VITE_FIREBASE_*`.
6. Configure o Firebase Admin:
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
7. Publique o arquivo `firestore.rules`.

### Coleções principais

- `users`
- `products`
- `sales`
- `farms`
- `actions`
- `notices`
- `settings`

A taxa da facção fica armazenada em:

```text
settings/general.factionFeePercentage
```

## Líderes iniciais

As contas administrativas podem ser criadas pelo script sem armazenar senhas diretamente no repositório.

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

## Desenvolvimento local

Instale as dependências:

```bash
npm install
```

Como o projeto utiliza funções serverless em `/api`, para testar todas as funcionalidades localmente prefira:

```bash
npx vercel dev
```

## Build

Antes de publicar:

```bash
npm run build
```

## Deploy

1. Envie as alterações para o GitHub.
2. A Vercel executará o novo deploy.
3. Confirme que todas as variáveis de ambiente estão cadastradas.
4. Quando adicionar ou alterar variáveis, faça um novo deploy para que elas sejam carregadas.

## Segurança

- Nunca envie `.env` ou `.env.local` ao GitHub.
- Nunca exponha `FIREBASE_ADMIN_PRIVATE_KEY`.
- Nunca exponha `CLOUDINARY_API_SECRET`.
- Nunca coloque tokens de webhook do Discord diretamente no código.
- Utilize variáveis de ambiente para credenciais e segredos.

## Identidade visual

Tema escuro da Dominus com predominância de:

- Preto
- Roxo
- Dourado
- Branco

A interface foi desenvolvida para manter o painel administrativo organizado, responsivo e consistente entre as diferentes funcionalidades.
