const http = require('http');

const PORT = 3000;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log("Iniciando bateria de testes...\n");

  try {
    // Teste 1: Buscar Álbuns
    console.log("1. Testando /api/search-albums?q=test");
    const searchRes = await request('/api/search-albums?q=test');
    console.log(`Status: ${searchRes.status}`);
    console.log(`Dados (resumo): ${searchRes.data.substring(0, 100)}...\n`);
    
    // Teste 2: Scrape inválido
    console.log("2. Testando /api/scrape?url=invalid");
    const scrapeRes = await request('/api/scrape?url=invalid');
    console.log(`Status: ${scrapeRes.status}`);
    console.log(`Dados: ${scrapeRes.data.substring(0, 100)}...\n`);
    
    // Teste 3: Bookmarklet poll (deve retornar null se vazio)
    console.log("3. Testando /api/bookmarklet-poll");
    const pollRes = await request('/api/bookmarklet-poll');
    console.log(`Status: ${pollRes.status}`);
    console.log(`Dados: ${pollRes.data}\n`);
    
    console.log("✅ Sequência de testes concluída com sucesso.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro durante os testes:", err.message);
    process.exit(1);
  }
}

runTests();
