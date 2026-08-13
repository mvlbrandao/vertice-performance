/**
 * Ajuda por tela: o que ela resolve e as ações que importam.
 *
 * Deliberadamente um painel sob demanda, e não um tour passo a passo em
 * cada página: tour quebra a cada mudança de layout, é caro de manter e é
 * a primeira coisa que o usuário fecha. Um "?" fica disponível quando a
 * pessoa precisa e invisível quando não.
 *
 * Texto curto de propósito. Ajuda que exige leitura longa não é lida.
 */
export interface PageHelp {
  titulo: string;
  resumo: string;
  acoes: string[];
}

export const PAGE_HELP: Record<string, PageHelp> = {
  "/dashboard": {
    titulo: "Painel",
    resumo: "O retrato do clube hoje: quem treinou, o que entra e o que está atrasado.",
    acoes: [
      "Os cartões de cima mostram atletas ativos, check-ins do dia e encontros da semana.",
      "Inadimplência em vermelho é dinheiro vencido — toque para ver quem deve.",
      "Em “Meus atletas”, toque num nome para abrir a ficha completa.",
    ],
  },
  "/athletes": {
    titulo: "Atletas",
    resumo: "O cadastro do clube. Cada atleta tem ficha, score, financeiro e histórico.",
    acoes: [
      "“+ Novo atleta” cadastra. Time e categoria organizam a lista e as convocações.",
      "Use os filtros do topo para achar por sub, posição ou faixa de score.",
      "Atleta desativado sai das convocações mas continua no histórico.",
    ],
  },
  "/agenda": {
    titulo: "Agenda de encontros",
    resumo: "Treinos e reuniões marcados, com confirmação de presença do atleta.",
    acoes: [
      "Crie o encontro e escolha quem participa — cada um recebe aviso.",
      "O atleta confirma pelo app; você acompanha quem confirmou.",
    ],
  },
  "/plays": {
    titulo: "Mesa tática",
    resumo: "Jogadas desenhadas em quadros, que rodam como animação para o atleta estudar.",
    acoes: [
      "As marcadas com ⭐ Padrão são da biblioteca do sistema e servem de ponto de partida.",
      "“+ Nova jogada” abre o editor: arraste os jogadores e crie um quadro por movimento.",
      "Você pode vincular uma jogada à escalação de um jogo, para o convocado estudar antes.",
    ],
  },
  "/jogos": {
    titulo: "Jogos",
    resumo: "Calendário por competição, com escalação e súmula de cada partida.",
    acoes: [
      "Crie a competição primeiro, depois os jogos dentro dela.",
      "Em “Escalação”, marque titular, reserva ou convocado e publique — os atletas são avisados.",
      "A súmula registra gols, assistências e cartões, que alimentam o score.",
    ],
  },
  "/comissao-tecnica": {
    titulo: "Comissão técnica",
    resumo: "Gráfico de dispersão para achar quem está fora da curva no elenco.",
    acoes: [
      "Horizontal é ataque, vertical é defesa. Quem está no canto superior direito puxa o time.",
      "Filtre por sub para comparar dentro da mesma idade.",
      "Abaixo do gráfico, a lista aponta o que cada atleta precisa evoluir.",
    ],
  },
  "/inadimplencia": {
    titulo: "Inadimplência",
    resumo: "Quem está devendo e há quanto tempo, agrupado por faixa de atraso.",
    acoes: [
      "As faixas separam quem atrasou dias de quem atrasou meses — a conversa é diferente.",
      "O botão do WhatsApp abre a conversa com a mensagem de cobrança já escrita.",
    ],
  },
  "/auditoria": {
    titulo: "Auditoria",
    resumo: "Quem fez o quê e quando, no dinheiro, no cadastro, na convocação e no acesso.",
    acoes: [
      "Use os filtros para ver só uma área.",
      "Serve para responder “quem me tirou da escalação” e “quem apagou esse registro”.",
    ],
  },
  "/config": {
    titulo: "Configurações e segurança",
    resumo: "Integrações do clube, privacidade e proteção de dados dos atletas.",
    acoes: [
      "Conecte a conta Asaas do clube para cobrar por cartão, PIX e boleto.",
      "Depois de conectar, cadastre o endereço de webhook no painel do Asaas para o pagamento baixar sozinho.",
    ],
  },
  "/equipe": {
    titulo: "Equipe",
    resumo: "Profissionais do clube e a quais atletas cada um tem acesso.",
    acoes: [
      "Convide o profissional e depois libere atleta por atleta — ninguém vê tudo por padrão.",
      "As áreas definem o que ele enxerga da ficha (físico, nutrição, financeiro).",
    ],
  },
};
