/**
 * MONITOR DE CONCURSOS - PSICOLOGIA & ADMINISTRAÇÃO
 * Versão Cloud (GitHub Actions + Bun)
 */

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Agora monitoramos duas URLs distintas
const URLS = [
  "https://www.pciconcursos.com.br/cargos/psicologo",
  "https://www.pciconcursos.com.br/cargos/administrador"
];

const CACHE_FILE = "pci_cache.json";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
             "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SE","TO"];

async function buscarConcursos() {
  console.log(`[${new Date().toLocaleString('pt-BR')}] Iniciando busca multicarreira...`);
  
  if (!TOKEN || !CHAT_ID) {
    console.error("ERRO: Credenciais não configuradas.");
    return;
  }

  try {
    let resultadosGerais = [];

    // Percorre cada uma das URLs configuradas
    for (const url of URLS) {
      const response = await fetch(url);
      const html = await response.text();
      
      const blocos = html.split('<ul class="link-d">');

      for (let i = 1; i < blocos.length; i++) {
        let bloco = blocos[i];
        let orgaoMatch = bloco.match(/class="noticia_desc[^"]*">(.*?)<\/a>/);
        let orgao = orgaoMatch ? orgaoMatch[1].replace(/\s+/g, " ").trim() : null;

        let cargoMatch = bloco.match(/<ul class="link-i">[\s\S]*?<a[^>]*>(.*?)<\/a>/);
        let cargo = cargoMatch 
          ? cargoMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() 
          : null;

        if (orgao && cargo) resultadosGerais.push({ orgao, cargo });
      }
    }

    // Filtro atualizado para incluir Administrador
    let filtrados = resultadosGerais.filter(item => {
      const upper = (item.orgao + " " + item.cargo).toUpperCase();
      
      // Verifica se é um dos cargos desejados
      const ehCargoAlvo = upper.includes("PSICÓLOGO") || upper.includes("ADMINISTRADOR");
      if (!ehCargoAlvo) return false;

      // Mantém se for SP ou se não tiver UF específica (Nacional)
      if (upper.includes(" - SP")) return true;
      return !UFS.some(uf => upper.includes(" - " + uf));
    });

    // Gestão de Cache
    let antigos = [];
    const file = Bun.file(CACHE_FILE);
    if (await file.exists()) {
      antigos = await file.json();
    }

    const novos = filtrados.filter(n => 
      !antigos.some(a => a.orgao === n.orgao && a.cargo === n.cargo)
    );

    if (novos.length > 0) {
      await enviarParaTelegram(novos);
    } else {
      console.log("Nenhum novo edital de Psicologia ou Administração.");
    }

    await Bun.write(CACHE_FILE, JSON.stringify(filtrados, null, 2));

  } catch (error) {
    console.error("Erro na execução:", error.message);
  }
}

async function enviarParaTelegram(lista) {
  let mensagem = "<b>🔔 Novas Vagas Detectadas!</b>\n\n";
  
  lista.forEach(item => {
    mensagem += `🏛️ <b>${item.orgao}</b>\n👉 ${item.cargo}\n\n`;
  });

  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: mensagem,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    console.log(`${lista.length} notificações enviadas.`);
  } catch (e) {
    console.error("Erro Telegram:", e.message);
  }
}

buscarConcursos();
