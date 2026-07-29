const animadoChamada = document.querySelector('.animado-chamada');
const formCadastro = document.querySelector('.cadastro form');
const sectionCadastro = document.querySelector('.cadastro');
const sectionUsuarioLogado = document.querySelector('.usuario-logado');
const saudacao = document.getElementById('saudacao');
const btnCadastrar = document.getElementById('btn-cadastrar');
const btnEntrar = document.getElementById('btn-entrar');
const btnSair = document.getElementById('btn-sair');
const mensagemAuth = document.getElementById('mensagem-auth');
const btnPublicar = document.getElementById('publicar');
const inputArquivo = document.getElementById('arquivo');
const btnCamera = document.getElementById('camera');
const obras = document.querySelector('.obras');

// --- Configuração do Supabase ---
const SUPABASE_URL = 'https://icjxpysnjhoptkznxdty.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljanhweXNuamhvcHRrem54ZHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjUxMzIsImV4cCI6MjEwMDg0MTEzMn0.oIuu620ktA74AVT-Pql7LbfjGf8UJMu_3nhN-0VjS1M';
const BUCKET_IMAGENS = 'obras-imagens';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CHAVE_PERFIL = 'olhoDaArte_perfil'; // guarda só nome/whatsapp associados ao email, localmente

let usuarioLogado = false;
let nomeUsuario = '';
let whatsappUsuario = '';

// Ao abrir a página: verifica se já há sessão ativa
window.addEventListener('DOMContentLoaded', async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        aplicarSessao(session);
    }
    await carregarObras();
});

// Registo de nova conta
btnCadastrar.addEventListener('click', async function(event) {
    event.preventDefault();
    mensagemAuth.textContent = '';

    const nome = document.getElementById('nome').value;
    const whatsapp = document.getElementById('whatsapp').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    if (!nome || !whatsapp || !email || !senha) {
        mensagemAuth.textContent = 'Preencha todos os campos.';
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: senha
    });

    if (error) {
        mensagemAuth.textContent = 'Erro ao cadastrar: ' + error.message;
        return;
    }

    // Guarda nome/whatsapp associados a este email, localmente neste navegador
    salvarPerfilLocal(email, nome, whatsapp);

    if (data.session) {
        aplicarSessao(data.session);
        await carregarObras();
    } else {
        mensagemAuth.textContent = 'Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.';
    }
});

// Login
btnEntrar.addEventListener('click', async function(event) {
    event.preventDefault();
    mensagemAuth.textContent = '';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    if (!email || !senha) {
        mensagemAuth.textContent = 'Preencha e-mail e senha para entrar.';
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (error) {
        mensagemAuth.textContent = 'Erro ao entrar: ' + error.message;
        return;
    }

    // Se já tiver perfil guardado neste navegador, usa; senão usa o que estiver no formulário
    const perfil = carregarPerfilLocal(email);
    const nome = perfil ? perfil.nome : document.getElementById('nome').value;
    const whatsapp = perfil ? perfil.whatsapp : document.getElementById('whatsapp').value;
    salvarPerfilLocal(email, nome, whatsapp);

    aplicarSessao(data.session);
    await carregarObras();
});

// Logout
btnSair.addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    usuarioLogado = false;
    nomeUsuario = '';
    whatsappUsuario = '';
    sectionCadastro.style.display = '';
    sectionUsuarioLogado.style.display = 'none';
    formCadastro.reset();
});

// Aplica o estado de "logado" na interface a partir de uma sessão do Supabase
function aplicarSessao(session) {
    usuarioLogado = true;

    const perfil = carregarPerfilLocal(session.user.email);
    nomeUsuario = perfil ? perfil.nome : session.user.email;
    whatsappUsuario = perfil ? perfil.whatsapp : '';

    sectionCadastro.style.display = 'none';
    animadoChamada.style.display = 'none';
    sectionUsuarioLogado.style.display = '';
    saudacao.textContent = `Você está conectado como ${nomeUsuario}`;
}

// Perfil (nome/whatsapp) guardado localmente, associado ao email
function salvarPerfilLocal(email, nome, whatsapp) {
    const perfis = JSON.parse(localStorage.getItem(CHAVE_PERFIL)) || {};
    perfis[email] = { nome: nome, whatsapp: whatsapp };
    localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfis));
}

function carregarPerfilLocal(email) {
    const perfis = JSON.parse(localStorage.getItem(CHAVE_PERFIL)) || {};
    return perfis[email] || null;
}

// Publicação de obras
btnPublicar.addEventListener('click', async function() {
    if (!usuarioLogado) {
        alert('Faça login ou cadastre-se para publicar!');
        return;
    }

    const imagem = inputArquivo.files[0];
    if (!imagem) {
        alert('Selecione uma imagem para publicar!');
        return;
    }

    btnPublicar.disabled = true;
    btnPublicar.textContent = 'Publicando...';

    try {
        await publicarObra(imagem);
    } catch (erro) {
        console.error(erro);
        alert('Não foi possível publicar a obra. Tente novamente.');
    } finally {
        btnPublicar.disabled = false;
        btnPublicar.textContent = 'Publicar';
        inputArquivo.value = '';
    }
});

// Usar câmera do dispositivo
btnCamera.addEventListener('click', function() {
    if (!usuarioLogado) {
        alert('Faça login ou cadastre-se para publicar!');
        return;
    }

    inputArquivo.setAttribute('capture', 'environment');
    inputArquivo.click();
});

// Envia a imagem para o Storage e grava o registo na tabela "obras"
async function publicarObra(arquivoImagem) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    const nomeArquivo = `${Date.now()}-${arquivoImagem.name}`;

    const { error: erroUpload } = await supabaseClient
        .storage
        .from(BUCKET_IMAGENS)
        .upload(nomeArquivo, arquivoImagem);

    if (erroUpload) throw erroUpload;

    const { data: urlPublica } = supabaseClient
        .storage
        .from(BUCKET_IMAGENS)
        .getPublicUrl(nomeArquivo);

    const { error: erroInsert } = await supabaseClient
        .from('obras')
        .insert({
            nome: nomeUsuario,
            whatsapp: whatsappUsuario,
            imagem_url: urlPublica.publicUrl,
            user_id: user.id
        });

    if (erroInsert) throw erroInsert;

    await carregarObras();
}

// Busca todas as obras na base de dados e desenha a galeria
async function carregarObras() {
    const { data, error } = await supabaseClient
        .from('obras')
        .select('nome, whatsapp, imagem_url')
        .order('criado_em', { ascending: false });

    if (error) {
        console.error('Erro ao carregar obras:', error);
        return;
    }

    obras.innerHTML = '';
    data.forEach(function(obra) {
        renderizarObra(obra.imagem_url, obra.nome, obra.whatsapp);
    });
}

// Monta e insere o cartão de uma obra na galeria
function renderizarObra(imagemUrl, nome, whatsapp) {
    const divObra = document.createElement('div');
    divObra.classList.add('obra');

    const img = document.createElement('img');
    img.src = imagemUrl;
    img.alt = `Obra de ${nome}`;

    const divContato = document.createElement('div');
    divContato.classList.add('contato');

    const nomeEl = document.createElement('p');
    nomeEl.textContent = nome;

    const linkWhats = document.createElement('a');
    const numeroLimpo = whatsapp.replace(/\D/g, '');
    linkWhats.href = `https://wa.me/${numeroLimpo}`;
    linkWhats.textContent = 'Falar no WhatsApp';
    linkWhats.target = '_blank';
    linkWhats.classList.add('link-contato');

    const linkSms = document.createElement('a');
    linkSms.href = `sms:${numeroLimpo}`;
    linkSms.textContent = 'Enviar SMS';
    linkSms.classList.add('link-contato');

    const linkLigar = document.createElement('a');
    linkLigar.href = `tel:${numeroLimpo}`;
    linkLigar.textContent = 'Ligar';
    linkLigar.classList.add('link-contato');

    divContato.appendChild(nomeEl);
    divContato.appendChild(linkWhats);
    divContato.appendChild(linkSms);
    divContato.appendChild(linkLigar);

    divObra.appendChild(img);
    divObra.appendChild(divContato);

    obras.appendChild(divObra);
      }
