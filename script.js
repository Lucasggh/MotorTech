/**
 * ==========================================================================
 * MotorTech - Sistema de Centro Automotivo & Quadro de Controle
 * Lógica da Aplicação com Login, Permissões e Histórico
 * ==========================================================================
 */

const LOCAL_STORAGE_KEY_OS = "motortech_os";
const LOCAL_STORAGE_KEY_ORC = "motortech_orc";
const LOCAL_STORAGE_KEY_FUNC = "motortech_employees";
const LOCAL_STORAGE_KEY_SESSION = "motortech_session";
const LOCAL_STORAGE_KEY_HISTORY = "motortech_history";

let currentUser = null;

// Inicializa a aplicação
document.addEventListener("DOMContentLoaded", () => {
    inicializarApp();
});

function inicializarApp() {
    // 1. Inicializar bancos de dados se não existirem
    if (!localStorage.getItem(LOCAL_STORAGE_KEY_OS)) localStorage.setItem(LOCAL_STORAGE_KEY_OS, JSON.stringify([]));
    if (!localStorage.getItem(LOCAL_STORAGE_KEY_ORC)) localStorage.setItem(LOCAL_STORAGE_KEY_ORC, JSON.stringify([]));
    if (!localStorage.getItem(LOCAL_STORAGE_KEY_FUNC)) localStorage.setItem(LOCAL_STORAGE_KEY_FUNC, JSON.stringify([]));
    if (!localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY)) {
        localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify({
            logs: [],
            concluidas: [],
            excluidas: []
        }));
    }

    // 2. Configurar Autenticação e Sessão
    configurarAutenticacao();

    // 3. Configurações de UI Globais
    configurarNavegacao();
    configurarFormularios();
    configurarMenuMobile();
    configurarModalEdicao();
    configurarFiltros();
}

function configurarFiltros() {
    const filterDate = document.getElementById("filter-date");
    const filterPriority = document.getElementById("filter-priority");
    const btnClearFilters = document.getElementById("btn-clear-filters");

    if(filterDate) {
        filterDate.addEventListener("change", atualizarTelas);
    }
    if(filterPriority) {
        filterPriority.addEventListener("change", atualizarTelas);
    }
    if(btnClearFilters) {
        btnClearFilters.addEventListener("click", () => {
            if(filterDate) filterDate.value = "";
            if(filterPriority) filterPriority.value = "";
            atualizarTelas();
        });
    }
}

/* ==========================================================================
   1. SISTEMA DE LOGIN E CONTROLE DE ACESSO
   ========================================================================== */

function configurarAutenticacao() {
    const loginOverlay = document.getElementById("login-container");
    const formLogin = document.getElementById("form-login");
    const btnLogout = document.getElementById("btn-logout-action");
    
    // Verifica se há sessão ativa
    const sessaoSalva = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
    
    if (sessaoSalva) {
        currentUser = JSON.parse(sessaoSalva);
        loginOverlay.classList.add("hidden");
        aplicarPermissoes(currentUser);
        atualizarTelas();
    } else {
        loginOverlay.classList.remove("hidden");
    }

    // Handle Login
    formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("login-username").value.trim().toLowerCase();
        const passwordInput = document.getElementById("login-password").value;
        const erroMsg = document.getElementById("login-error");
        // Validação de Admin (Master)
        if (usernameInput === "admin" && passwordInput === "admin") {
            efetuarLogin("admin", "admin");
            return;
        } 
        
        // Validação Dinâmica de Funcionário
        const listaFunc = obterDados(LOCAL_STORAGE_KEY_FUNC);
        const senhaLimpa = passwordInput.replace(/\D/g, ""); // Remove pontos e traços do CPF digitado
        
        const funcEncontrado = listaFunc.find(func => {
            const nomeBanco = func.nome.trim().toLowerCase();
            const cpfBanco = func.cpf.replace(/\D/g, "");
            return nomeBanco === usernameInput && cpfBanco === senhaLimpa;
        });

        if (funcEncontrado) {
            efetuarLogin(funcEncontrado.nome, "funcionario");
        } else {
            erroMsg.classList.remove("hidden");
            setTimeout(() => erroMsg.classList.add("hidden"), 3000);
        }
    });

    // Handle Logout
    btnLogout.addEventListener("click", () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
        currentUser = null;
        document.getElementById("form-login").reset();
        document.getElementById("login-container").classList.remove("hidden");
        // Forçar volta para aba de painel
        switchTab("painel-controle");
    });
}

function efetuarLogin(username, role) {
    currentUser = { username, role };
    localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, JSON.stringify(currentUser));
    
    document.getElementById("login-container").classList.add("hidden");
    aplicarPermissoes(currentUser);
    atualizarTelas();
    
    registrarLogDeAuditoria("Iniciou sessão no sistema", "login");
}

function aplicarPermissoes(user) {
    const navFuncionarios = document.getElementById("nav-btn-funcionarios");
    const colFuncionarios = document.getElementById("col-funcionarios-dashboard");
    const mainGrid = document.getElementById("main-dashboard-grid");
    const badgePerfil = document.getElementById("user-profile-badge");

    if (user.role === "admin") {
        navFuncionarios.style.display = "block";
        colFuncionarios.style.display = "block";
        mainGrid.style.gridTemplateColumns = "1fr 1fr 1fr";
        badgePerfil.textContent = "Admin";
        badgePerfil.style.backgroundColor = "rgba(255, 107, 0, 0.2)";
        badgePerfil.style.color = "var(--accent)";
    } else {
        // Modo Funcionário: Esconde a aba e a coluna
        navFuncionarios.style.display = "none";
        colFuncionarios.style.display = "none";
        mainGrid.style.gridTemplateColumns = "1fr 1fr"; // Ocupa a tela com Orçamentos e O.S.
        badgePerfil.textContent = "Funcionário";
        badgePerfil.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        badgePerfil.style.color = "var(--text-main)";
        
        // Se a pessoa estiver na aba funcionarios ao logar/recarregar, redireciona pro painel
        const abaAtual = document.querySelector(".tab-content.active").id;
        if (abaAtual === "cadastro-funcionario") {
            switchTab("painel-controle");
        }
    }
}

/* ==========================================================================
   2. HISTÓRICO E AUDITORIA
   ========================================================================== */

function registrarLogDeAuditoria(descricaoAcao, tipo = "geral") {
    if (!currentUser) return;

    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString("pt-BR") + " " + dataAtual.toLocaleTimeString("pt-BR").slice(0,5);

    const historico = obterDados(LOCAL_STORAGE_KEY_HISTORY);
    
    // Adiciona log no início do array (mais recente primeiro)
    historico.logs.unshift({
        id: Date.now(),
        usuario: currentUser.username,
        acao: descricaoAcao,
        data: dataFormatada,
        tipo: tipo // pode ser: 'criou', 'editou', 'concluiu', 'excluiu', 'login'
    });

    // Mantém apenas os 100 logs mais recentes para não pesar o storage
    if (historico.logs.length > 100) {
        historico.logs.pop();
    }

    salvarDados(LOCAL_STORAGE_KEY_HISTORY, historico);
}

/* ==========================================================================
   3. NAVEGAÇÃO E SPA
   ========================================================================== */

function configurarNavegacao() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", () => switchTab(link.getAttribute("data-target")));
    });
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("data-target") === tabId) link.classList.add("active");
    });
    
    const targetTabElement = document.getElementById(tabId);
    if (targetTabElement) {
        targetTabElement.classList.add("active");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Se a aba destino for Histórico, atualiza as listagens
        if (tabId === "historico-painel") {
            renderizarHistorico();
        }
    }

    const navMenu = document.querySelector(".nav-menu");
    const menuToggle = document.getElementById("menuToggle");
    if (navMenu.classList.contains("open")) {
        navMenu.classList.remove("open");
        menuToggle.classList.remove("active");
    }
}
window.switchTab = switchTab;

function configurarMenuMobile() {
    const menuToggle = document.getElementById("menuToggle");
    const navMenu = document.querySelector(".nav-menu");
    menuToggle.addEventListener("click", () => {
        navMenu.classList.toggle("open");
        menuToggle.classList.toggle("active");
    });
}

/* ==========================================================================
   4. FORMULÁRIOS DE CRIAÇÃO (O.S. E FUNCIONÁRIO)
   ========================================================================== */

function configurarFormularios() {
    const formOS = document.getElementById("form-os");
    const formFunc = document.getElementById("form-funcionario");
    const cpfInput = document.getElementById("func-cpf");

    // FORMULÁRIO DE ORÇAMENTO
    const formOrcamento = document.getElementById("form-orcamento");
    const btnRevisarOrcamento = document.getElementById("btn-revisar-orcamento");
    const modalConfirmOrc = document.getElementById("modal-confirm-orc");
    const btnCloseConfirmOrc = document.getElementById("btn-close-confirm-orc");
    const btnCancelConfirmOrc = document.getElementById("btn-cancel-confirm-orc");
    const btnSaveConfirmOrc = document.getElementById("btn-save-confirm-orc");

    // Validação e Revisão do Orçamento
    btnRevisarOrcamento.addEventListener("click", () => {
        const clienteInput = document.getElementById("orc-cliente");
        const telefoneInput = document.getElementById("orc-telefone");
        const placaInput = document.getElementById("orc-placa");
        const modeloInput = document.getElementById("orc-modelo");
        const kmInput = document.getElementById("orc-km");
        const prioridadeInput = document.getElementById("orc-prioridade");
        const problemaInput = document.getElementById("orc-problema");

        removerErrosFormulario(formOrcamento);

        let formValido = true;
        const clienteVal = clienteInput.value.trim();
        if (!clienteVal || clienteVal.length < 3 || !clienteVal.includes(" ") || /\d/.test(clienteVal)) {
            marcarErroCampo(clienteInput, "error-orc-cliente", "Preencha Nome e Sobrenome (sem números).");
            formValido = false;
        }
        const telLimpo = telefoneInput.value.replace(/\D/g, '');
        if (!telLimpo || telLimpo.length < 10 || /^(\d)\1+$/.test(telLimpo)) {
            marcarErroCampo(telefoneInput, "error-orc-telefone", "Informe um telefone válido real com DDD.");
            formValido = false;
        }
        const placaRegex = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;
        if (!placaInput.value.trim() || !placaRegex.test(placaInput.value.trim())) {
            marcarErroCampo(placaInput, "error-orc-placa", "Placa inválida. Use o padrão Mercosul ou antigo.");
            formValido = false;
        }
        if (!modeloInput.value.trim() || modeloInput.value.trim().length < 2 || !/[a-zA-Z]/.test(modeloInput.value)) {
            marcarErroCampo(modeloInput, "error-orc-modelo", "Informe o nome/modelo do carro (deve conter letras).");
            formValido = false;
        }
        const kmVal = parseInt(kmInput.value, 10);
        if (isNaN(kmVal) || kmVal < 0) {
            marcarErroCampo(kmInput, "error-orc-km", "Informe uma quilometragem válida.");
            formValido = false;
        }
        if (!problemaInput.value.trim() || problemaInput.value.trim().length < 10) {
            marcarErroCampo(problemaInput, "error-orc-problema", "Descreva detalhadamente o problema (mínimo 10 caracteres).");
            formValido = false;
        }

        if (formValido) {
            const dataHoje = new Date().toLocaleDateString("pt-BR");
            const placaDigitada = placaInput.value.trim().toUpperCase();
            const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
            const listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
            
            const conflitoOS = listaOS.some(os => os.placa === placaDigitada && os.dataAbertura === dataHoje);
            const conflitoOrc = listaOrc.some(orc => orc.placa === placaDigitada && orc.dataAbertura === dataHoje);
            
            if (conflitoOS || conflitoOrc) {
                marcarErroCampo(placaInput, "error-orc-placa", "Já existe um registro (O.S. ou Orçamento) ativo para esta placa hoje.");
                formValido = false;
                alert("Conflito detectado: Esta placa já possui uma solicitação ativa criada hoje. Por favor, verifique o painel ou edite a existente.");
            }
        }

        if (formValido) {
            // Preenche modal de revisão
            document.getElementById("rev-cliente").textContent = clienteInput.value.trim();
            document.getElementById("rev-telefone").textContent = telefoneInput.value.trim();
            document.getElementById("rev-placa").textContent = placaInput.value.trim().toUpperCase();
            document.getElementById("rev-modelo").textContent = modeloInput.value.trim();
            document.getElementById("rev-km").textContent = kmInput.value.trim();
            document.getElementById("rev-prioridade").textContent = prioridadeInput.value;
            document.getElementById("rev-problema").textContent = problemaInput.value.trim();
            
            modalConfirmOrc.classList.remove("hidden");
        }
    });

    const fecharModalConfirmOrc = () => {
        modalConfirmOrc.classList.add("hidden");
    };

    btnCloseConfirmOrc.addEventListener("click", fecharModalConfirmOrc);
    btnCancelConfirmOrc.addEventListener("click", fecharModalConfirmOrc);

    // Salvar Orçamento Final
    btnSaveConfirmOrc.addEventListener("click", () => {
        const novoOrc = {
            id: Date.now(),
            cliente: document.getElementById("orc-cliente").value.trim(),
            telefone: document.getElementById("orc-telefone").value.trim(),
            placa: document.getElementById("orc-placa").value.trim().toUpperCase(),
            modelo: document.getElementById("orc-modelo").value.trim(),
            km: document.getElementById("orc-km").value.trim(),
            prioridade: document.getElementById("orc-prioridade").value,
            problema: document.getElementById("orc-problema").value.trim(),
            dataAbertura: new Date().toLocaleDateString("pt-BR")
        };

        const listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
        listaOrc.push(novoOrc);
        salvarDados(LOCAL_STORAGE_KEY_ORC, listaOrc);
        
        registrarLogDeAuditoria(`Criou solicitação de Orçamento p/ ${novoOrc.cliente}`, "criou");

        fecharModalConfirmOrc();
        formOrcamento.reset();
        
        // Exibir feedback custom ou voltar para painel
        alert("Orçamento cadastrado com sucesso! Aguardando avaliação.");
        switchTab("painel-controle");
        atualizarTelas();
    });

    // Modal de Aprovação de Orçamento
    const modalApproveOrc = document.getElementById("modal-approve-orc");
    const formApproveOrc = document.getElementById("form-approve-orc");
    
    const fecharModalApprove = () => {
        modalApproveOrc.classList.add("hidden");
        formApproveOrc.reset();
        removerErrosFormulario(formApproveOrc);
    };

    document.getElementById("btn-close-approve-orc").addEventListener("click", fecharModalApprove);
    document.getElementById("btn-cancel-approve-orc").addEventListener("click", fecharModalApprove);

    formApproveOrc.addEventListener("submit", (e) => {
        e.preventDefault();
        const precoInput = document.getElementById("approve-preco");
        removerErrosFormulario(formApproveOrc);

        if (!precoInput.value.trim()) {
            marcarErroCampo(precoInput, "error-approve-preco");
            return;
        }

        const idOrc = parseInt(document.getElementById("approve-orc-id").value);
        const listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
        const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
        
        const index = listaOrc.findIndex(o => o.id === idOrc);
        if (index > -1) {
            const orc = listaOrc[index];
            const preco = precoInput.value.trim();
            
            // Cria nova O.S. baseada no orçamento
            const novaOS = {
                id: Date.now(),
                cliente: orc.cliente,
                placa: orc.placa,
                modelo: orc.modelo,
                km: orc.km || "",
                prioridade: orc.prioridade || "Média",
                preco: preco,
                problema: `[Aprovado do Orçamento] Telefone: ${orc.telefone}\n\nRelato: ${orc.problema}`,
                dataAbertura: new Date().toLocaleDateString("pt-BR")
            };
            
            listaOS.push(novaOS);
            listaOrc.splice(index, 1);
            
            salvarDados(LOCAL_STORAGE_KEY_ORC, listaOrc);
            salvarDados(LOCAL_STORAGE_KEY_OS, listaOS);
            
            registrarLogDeAuditoria(`Aprovou o orçamento de ${orc.cliente} (${preco}) e gerou a O.S.`, "editou");
            atualizarTelas();
            fecharModalApprove();
        }
    });

    // Máscara dinâmica de CPF
    cpfInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 3) val = val.replace(/^(\d{3})(\d)/, "$1.$2");
        if (val.length > 6) val = val.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
        if (val.length > 9) val = val.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
        e.target.value = val.substring(0, 14);
    });

    // Máscara de Telefone (Orçamento)
    const telefoneOrcInput = document.getElementById("orc-telefone");
    telefoneOrcInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, ""); // Remove tudo que não for número
        if (val.length > 2) val = val.replace(/^(\d{2})(\d)/g, "($1) $2");
        if (val.length > 9) val = val.replace(/(\d{5})(\d)/, "$1-$2"); // Celular
        else if (val.length > 8) val = val.replace(/(\d{4})(\d)/, "$1-$2"); // Fixo
        e.target.value = val.substring(0, 15);
    });

    // Máscara de Preço (Aprovação de Orçamento)
    const precoApproveInput = document.getElementById("approve-preco");
    precoApproveInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, ""); // Só números
        if (val === "") {
            e.target.value = "";
            return;
        }
        val = (parseInt(val, 10) / 100).toFixed(2) + "";
        val = val.replace(".", ",");
        val = val.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        e.target.value = "R$ " + val;
    });

    // Formatação de Placas (Maiúsculas e limitando caracteres)
    const formatarPlaca = (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").substring(0, 8);
    };
    document.getElementById("orc-placa").addEventListener("input", formatarPlaca);
    document.getElementById("os-placa").addEventListener("input", formatarPlaca);
    document.getElementById("edit-os-placa").addEventListener("input", formatarPlaca);

    // Submissão Nova O.S.
    formOS.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const clienteInput = document.getElementById("os-cliente");
        const placaInput = document.getElementById("os-placa");
        const modeloInput = document.getElementById("os-modelo");
        const kmInput = document.getElementById("os-km");
        const problemaInput = document.getElementById("os-problema");

        removerErrosFormulario(formOS);

        let formValido = true;
        const clienteVal = clienteInput.value.trim();
        if (!clienteVal || clienteVal.length < 3 || !clienteVal.includes(" ") || /\d/.test(clienteVal)) {
            marcarErroCampo(clienteInput, "error-cliente", "Preencha Nome e Sobrenome (sem números).");
            formValido = false;
        }
        const placaRegex = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;
        if (!placaInput.value.trim() || !placaRegex.test(placaInput.value.trim())) {
            marcarErroCampo(placaInput, "error-placa", "Placa inválida. Use o padrão Mercosul ou antigo.");
            formValido = false;
        }
        if (!modeloInput.value.trim() || modeloInput.value.trim().length < 2 || !/[a-zA-Z]/.test(modeloInput.value)) {
            marcarErroCampo(modeloInput, "error-modelo", "Informe o nome/modelo do carro (deve conter letras).");
            formValido = false;
        }
        const kmValOS = parseInt(kmInput.value, 10);
        if (isNaN(kmValOS) || kmValOS < 0) {
            marcarErroCampo(kmInput, "error-os-km", "Informe uma quilometragem válida.");
            formValido = false;
        }
        if (!problemaInput.value.trim() || problemaInput.value.trim().length < 10) {
            marcarErroCampo(problemaInput, "error-problema", "Descreva detalhadamente o problema (mínimo 10 caracteres).");
            formValido = false;
        }

        if (formValido) {
            const dataHoje = new Date().toLocaleDateString("pt-BR");
            const placaDigitada = placaInput.value.trim().toUpperCase();
            const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
            const listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
            
            const conflitoOS = listaOS.some(os => os.placa === placaDigitada && os.dataAbertura === dataHoje);
            const conflitoOrc = listaOrc.some(orc => orc.placa === placaDigitada && orc.dataAbertura === dataHoje);
            
            if (conflitoOS || conflitoOrc) {
                marcarErroCampo(placaInput, "error-placa", "Já existe um registro (O.S. ou Orçamento) ativo para esta placa hoje.");
                formValido = false;
                alert("Conflito detectado: Esta placa já possui uma solicitação ativa criada hoje. Por favor, verifique o painel ou edite a existente.");
            }
        }

        if (formValido) {
            const novaOS = {
                id: Date.now(),
                cliente: clienteInput.value.trim(),
                placa: placaInput.value.trim().toUpperCase(),
                modelo: modeloInput.value.trim(),
                km: kmInput.value.trim(),
                prioridade: document.getElementById("os-prioridade").value,
                problema: problemaInput.value.trim(),
                dataAbertura: new Date().toLocaleDateString("pt-BR")
            };

            const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
            listaOS.push(novaOS);
            salvarDados(LOCAL_STORAGE_KEY_OS, listaOS);
            
            registrarLogDeAuditoria(`Cadastrou a O.S. para o cliente ${novaOS.cliente}`, "criou");

            exibirFeedbackSucesso("os-success");
            formOS.reset();
            atualizarTelas();
        }
    });

    // Submissão Novo Funcionário
    formFunc.addEventListener("submit", (e) => {
        e.preventDefault();

        const nomeInput = document.getElementById("func-nome");
        const cpfInput = document.getElementById("func-cpf");
        const nascimentoInput = document.getElementById("func-nascimento");

        removerErrosFormulario(formFunc);

        let formValido = true;
        if (!nomeInput.value.trim()) { marcarErroCampo(nomeInput, "error-func-nome"); formValido = false; }
        if (!validarCPF(cpfInput.value)) { marcarErroCampo(cpfInput, "error-func-cpf"); formValido = false; }
        if (!nascimentoInput.value) { marcarErroCampo(nascimentoInput, "error-func-nasc"); formValido = false; }

        if (formValido) {
            const novoFuncionario = {
                id: Date.now(),
                nome: nomeInput.value.trim(),
                cpf: cpfInput.value.trim(),
                nascimento: formatarDataBr(nascimentoInput.value)
            };

            const listaFunc = obterDados(LOCAL_STORAGE_KEY_FUNC);
            listaFunc.push(novoFuncionario);
            salvarDados(LOCAL_STORAGE_KEY_FUNC, listaFunc);

            registrarLogDeAuditoria(`Cadastrou o funcionário ${novoFuncionario.nome}`, "criou");

            exibirFeedbackSucesso("func-success");
            formFunc.reset();
            atualizarTelas();
        }
    });
}

/* ==========================================================================
   5. MODAL DE EDIÇÃO DE O.S. E SEUS EVENTOS
   ========================================================================== */

function configurarModalEdicao() {
    const modalEdit = document.getElementById("modal-edit-os");
    const btnClose = document.getElementById("btn-close-modal");
    const btnCancel = document.getElementById("btn-cancel-modal");
    const formEdit = document.getElementById("form-edit-os");

    const fecharModal = () => {
        modalEdit.classList.add("hidden");
        formEdit.reset();
        removerErrosFormulario(formEdit);
    };

    btnClose.addEventListener("click", fecharModal);
    btnCancel.addEventListener("click", fecharModal);

    // Salvar Edição
    formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const idOS = parseInt(document.getElementById("edit-os-id").value);
        const clienteInput = document.getElementById("edit-os-cliente");
        const placaInput = document.getElementById("edit-os-placa");
        const modeloInput = document.getElementById("edit-os-modelo");
        const kmInput = document.getElementById("edit-os-km");
        const prioridadeInput = document.getElementById("edit-os-prioridade");
        const problemaInput = document.getElementById("edit-os-problema");

        removerErrosFormulario(formEdit);
        let formValido = true;

        const clienteVal = clienteInput.value.trim();
        if (!clienteVal || clienteVal.length < 3 || !clienteVal.includes(" ") || /\d/.test(clienteVal)) {
            marcarErroCampo(clienteInput, "error-edit-cliente", "Preencha Nome e Sobrenome (sem números).");
            formValido = false;
        }
        const placaRegex = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;
        if (!placaInput.value.trim() || !placaRegex.test(placaInput.value.trim())) {
            marcarErroCampo(placaInput, "error-edit-placa", "Placa inválida. Use o padrão Mercosul ou antigo.");
            formValido = false;
        }
        if (!modeloInput.value.trim() || modeloInput.value.trim().length < 2 || !/[a-zA-Z]/.test(modeloInput.value)) {
            marcarErroCampo(modeloInput, "error-edit-modelo", "Informe o nome/modelo do carro (deve conter letras).");
            formValido = false;
        }
        const kmValEdit = parseInt(kmInput.value, 10);
        if (isNaN(kmValEdit) || kmValEdit < 0) {
            marcarErroCampo(kmInput, "error-edit-km", "Informe uma quilometragem válida.");
            formValido = false;
        }
        if (!problemaInput.value.trim() || problemaInput.value.trim().length < 10) {
            marcarErroCampo(problemaInput, "error-edit-problema", "Descreva detalhadamente o problema (mínimo 10 caracteres).");
            formValido = false;
        }

        if (formValido) {
            const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
            const osIndex = listaOS.findIndex(os => os.id === idOS);
            
            if (osIndex > -1) {
                listaOS[osIndex].cliente = clienteInput.value.trim();
                listaOS[osIndex].placa = placaInput.value.trim().toUpperCase();
                listaOS[osIndex].modelo = modeloInput.value.trim();
                listaOS[osIndex].km = kmInput.value.trim();
                listaOS[osIndex].prioridade = prioridadeInput.value;
                listaOS[osIndex].problema = problemaInput.value.trim();
                
                salvarDados(LOCAL_STORAGE_KEY_OS, listaOS);
                registrarLogDeAuditoria(`Editou a O.S. do cliente ${listaOS[osIndex].cliente}`, "editou");
                atualizarTelas();
                fecharModal();
            }
        }
    });
}

window.abrirModalEdicao = function(id) {
    const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
    const osParaEditar = listaOS.find(os => os.id === id);
    
    if (osParaEditar) {
        document.getElementById("edit-os-id").value = osParaEditar.id;
        document.getElementById("edit-os-cliente").value = osParaEditar.cliente;
        document.getElementById("edit-os-placa").value = osParaEditar.placa;
        document.getElementById("edit-os-modelo").value = osParaEditar.modelo;
        document.getElementById("edit-os-km").value = osParaEditar.km || "";
        document.getElementById("edit-os-prioridade").value = osParaEditar.prioridade || "Média";
        document.getElementById("edit-os-problema").value = osParaEditar.problema;
        
        document.getElementById("modal-edit-os").classList.remove("hidden");
    }
}

/* ==========================================================================
   6. CONCLUSÃO E EXCLUSÃO (CADEIA DE ESTADOS DA O.S.)
   ========================================================================== */

window.concluirOS = function(id) {
    if (confirm("Deseja marcar esta Ordem de Serviço como CONCLUÍDA?")) {
        const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
        const historico = obterDados(LOCAL_STORAGE_KEY_HISTORY);
        
        const osIndex = listaOS.findIndex(os => os.id === id);
        if (osIndex > -1) {
            const osConcluida = listaOS[osIndex];
            osConcluida.concluidaPor = currentUser.username;
            osConcluida.dataConclusao = new Date().toLocaleDateString("pt-BR");
            
            // Move de ativas para concluidas
            historico.concluidas.unshift(osConcluida);
            listaOS.splice(osIndex, 1);
            
            salvarDados(LOCAL_STORAGE_KEY_OS, listaOS);
            salvarDados(LOCAL_STORAGE_KEY_HISTORY, historico);
            
            registrarLogDeAuditoria(`Concluiu a O.S. de ${osConcluida.cliente} [${osConcluida.placa}]`, "concluiu");
            atualizarTelas();
        }
    }
}

window.removerOS = function(id) {
    if (confirm("ATENÇÃO: Deseja realmente remover (excluir) esta Ordem de Serviço do quadro?")) {
        const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
        const historico = obterDados(LOCAL_STORAGE_KEY_HISTORY);
        
        const osIndex = listaOS.findIndex(os => os.id === id);
        if (osIndex > -1) {
            const osDeletada = listaOS[osIndex];
            osDeletada.excluidaPor = currentUser.username;
            osDeletada.dataExclusao = new Date().toLocaleDateString("pt-BR");
            
            // Move para excluidas
            historico.excluidas.unshift(osDeletada);
            listaOS.splice(osIndex, 1);
            
            salvarDados(LOCAL_STORAGE_KEY_OS, listaOS);
            salvarDados(LOCAL_STORAGE_KEY_HISTORY, historico);
            
            registrarLogDeAuditoria(`Excluiu a O.S. de ${osDeletada.cliente} [${osDeletada.placa}]`, "excluiu");
            atualizarTelas();
        }
    }
}

window.aprovarOrcamento = function(id) {
    document.getElementById("approve-orc-id").value = id;
    document.getElementById("modal-approve-orc").classList.remove("hidden");
}

window.rejeitarOrcamento = function(id) {
    if (confirm("Deseja rejeitar e excluir este orçamento?")) {
        const listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
        const index = listaOrc.findIndex(o => o.id === id);
        if (index > -1) {
            const orc = listaOrc[index];
            listaOrc.splice(index, 1);
            
            salvarDados(LOCAL_STORAGE_KEY_ORC, listaOrc);
            
            registrarLogDeAuditoria(`Rejeitou/excluiu o orçamento de ${orc.cliente}`, "excluiu");
            atualizarTelas();
        }
    }
}

window.removerFuncionario = function(id) {
    if (confirm("Deseja remover o acesso deste funcionário?")) {
        const listaFunc = obterDados(LOCAL_STORAGE_KEY_FUNC);
        const funcionario = listaFunc.find(f => f.id === id);
        const novaLista = listaFunc.filter(func => func.id !== id);
        
        salvarDados(LOCAL_STORAGE_KEY_FUNC, novaLista);
        
        if (funcionario) {
            registrarLogDeAuditoria(`Deletou o funcionário ${funcionario.nome}`, "excluiu");
        }
        atualizarTelas();
    }
}

/* ==========================================================================
   7. RENDERIZAÇÃO DE INTERFACES E HISTÓRICO
   ========================================================================== */

function atualizarTelas() {
    let listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
    let listaOrc = obterDados(LOCAL_STORAGE_KEY_ORC);
    const listaFunc = obterDados(LOCAL_STORAGE_KEY_FUNC);

    // Apply Filters
    const filterDate = document.getElementById("filter-date")?.value;
    const filterPriority = document.getElementById("filter-priority")?.value;

    if (filterDate) {
        const parts = filterDate.split("-");
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD to DD/MM/YYYY
        listaOS = listaOS.filter(os => os.dataAbertura === formattedDate);
        listaOrc = listaOrc.filter(orc => orc.dataAbertura === formattedDate);
    }
    
    if (filterPriority) {
        listaOS = listaOS.filter(os => (os.prioridade || "Média") === filterPriority);
        listaOrc = listaOrc.filter(orc => (orc.prioridade || "Média") === filterPriority);
    }

    document.getElementById("count-os").textContent = listaOS.length;
    if(document.getElementById("count-orc")) {
        document.getElementById("count-orc").textContent = listaOrc.length;
    }
    document.getElementById("count-func").textContent = listaFunc.length;

    renderizarPainelOS(listaOS);
    renderizarPainelOrcamentos(listaOrc);
    
    // Atualiza funcionários apenas se for admin
    if (currentUser && currentUser.role === "admin") {
        renderizarPainelFuncionarios(listaFunc);
        renderizarTabelaRapidaFuncionarios(listaFunc);
    }
    
    // Atualiza a tela de histórico sempre que a tela em si atualiza
    renderizarHistorico();
}

function renderizarPainelOS(listaOS) {
    const container = document.getElementById("board-os");
    container.innerHTML = ""; 

    if (listaOS.length === 0) {
        container.innerHTML = `
            <div class="empty-board">
                <p>Nenhuma ordem de serviço ativa no momento.</p>
                <button class="btn-secondary btn-sm" onclick="switchTab('nova-os')">Criar Nova</button>
            </div>`;
        return;
    }

    listaOS.forEach(os => {
        const card = document.createElement("div");
        card.className = "os-card";
        card.innerHTML = `
            <div class="os-card-header">
                <span class="os-card-title">${escaparHTML(os.cliente)}</span>
                <span class="os-card-date">${os.dataAbertura}</span>
            </div>
            <div class="os-badges">
                <span class="badge" style="background-color: rgba(0, 188, 212, 0.15); color: #00bcd4; border: 1px solid #00bcd4;">CONFIRMADO / EM EXECUÇÃO</span>
                <span class="badge badge-plate">${escaparHTML(os.placa)}</span>
                <span class="badge badge-car">${escaparHTML(os.modelo)}</span>
                ${os.km ? `<span class="badge badge-plate">${escaparHTML(os.km)} km</span>` : ''}
                <span class="badge badge-priority badge-priority-${(os.prioridade || 'Média').toLowerCase().replace('é', 'e').replace('í', 'i')}">${escaparHTML(os.prioridade || 'Média')}</span>
                ${os.preco ? `<span class="badge" style="background-color:var(--success-bg); color:var(--success); border: 1px solid var(--success);">${escaparHTML(os.preco)}</span>` : ''}
            </div>
            <div class="os-description">${escaparHTML(os.problema)}</div>
            <div class="os-card-footer">
                <button class="btn-edit btn-sm" onclick="abrirModalEdicao(${os.id})">Editar</button>
                <button class="btn-success btn-sm" onclick="concluirOS(${os.id})">✔ Concluir</button>
                <button class="btn-danger btn-sm" onclick="removerOS(${os.id})">✖ Excluir</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderizarPainelOrcamentos(listaOrc) {
    const container = document.getElementById("board-orcamentos");
    if(!container) return;
    
    container.innerHTML = ""; 

    if (listaOrc.length === 0) {
        container.innerHTML = `
            <div class="empty-board">
                <p>Nenhum orçamento pendente.</p>
                <button class="btn-secondary btn-sm" onclick="switchTab('novo-orcamento')">Criar Orçamento</button>
            </div>`;
        return;
    }

    listaOrc.forEach(orc => {
        const card = document.createElement("div");
        card.className = "orc-card";
        card.innerHTML = `
            <div class="orc-card-header">
                <span class="orc-card-title">${escaparHTML(orc.cliente)}</span>
                <span class="orc-card-date">${orc.dataAbertura}</span>
            </div>
            <div class="os-badges">
                <span class="badge" style="background-color: rgba(255, 193, 7, 0.15); color: #ffc107; border: 1px solid #ffc107;">PENDENTE APROVAÇÃO</span>
                <span class="badge badge-plate">${escaparHTML(orc.placa)}</span>
                <span class="badge badge-car">${escaparHTML(orc.modelo)}</span>
                ${orc.km ? `<span class="badge badge-plate">${escaparHTML(orc.km)} km</span>` : ''}
                <span class="badge badge-priority badge-priority-${(orc.prioridade || 'Média').toLowerCase().replace('é', 'e').replace('í', 'i')}">${escaparHTML(orc.prioridade || 'Média')}</span>
            </div>
            <div class="os-description">${escaparHTML(orc.problema)}</div>
            <div class="os-card-footer">
                <button class="btn-success btn-sm" onclick="aprovarOrcamento(${orc.id})">✔ Aprovar (Vira O.S.)</button>
                <button class="btn-danger btn-sm" onclick="rejeitarOrcamento(${orc.id})">✖ Rejeitar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderizarPainelFuncionarios(listaFunc) {
    const container = document.getElementById("board-funcionarios");
    container.innerHTML = "";

    if (listaFunc.length === 0) {
        container.innerHTML = `<div class="empty-board"><p>Nenhum funcionário cadastrado.</p></div>`;
        return;
    }

    listaFunc.forEach(func => {
        const card = document.createElement("div");
        card.className = "func-card";
        card.innerHTML = `
            <div class="func-card-info">
                <h4>${escaparHTML(func.nome)}</h4>
                <div class="func-card-details">
                    <span>CPF: ${func.cpf}</span>
                </div>
            </div>
            <button class="btn-danger btn-sm" onclick="removerFuncionario(${func.id})">Excluir</button>
        `;
        container.appendChild(card);
    });
}

function renderizarTabelaRapidaFuncionarios(listaFunc) {
    const tbody = document.getElementById("quick-func-tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    if (listaFunc.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Nenhum cadastro.</td></tr>`;
        return;
    }

    listaFunc.forEach(func => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escaparHTML(func.nome)}</td>
            <td>${func.cpf}</td>
            <td>${func.nascimento}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarHistorico() {
    const historico = obterDados(LOCAL_STORAGE_KEY_HISTORY);
    
    // 1. Renderizar Logs (Timeline)
    const logsContainer = document.getElementById("logs-timeline-container");
    if(logsContainer) {
        logsContainer.innerHTML = "";
        if (historico.logs.length === 0) {
            logsContainer.innerHTML = `<div class="empty-message">Sem atividades recentes.</div>`;
        } else {
            historico.logs.forEach(log => {
                const item = document.createElement("div");
                item.className = `log-item log-${log.tipo}`;
                item.innerHTML = `
                    <span class="log-date">${log.data}</span>
                    <div class="log-desc">
                        <span class="log-user">@${log.usuario}</span>: ${escaparHTML(log.acao)}
                    </div>
                `;
                logsContainer.appendChild(item);
            });
        }
    }

    // 2. Renderizar Tabela O.S. Concluídas
    const concludedBody = document.getElementById("concluded-os-tbody");
    if(concludedBody) {
        concludedBody.innerHTML = "";
        if (historico.concluidas.length === 0) {
            concludedBody.innerHTML = `<tr><td colspan="5" class="empty-message">Nenhuma O.S. concluída no sistema.</td></tr>`;
        } else {
            historico.concluidas.forEach(os => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${escaparHTML(os.cliente)}</td>
                    <td>${escaparHTML(os.placa)}</td>
                    <td>${escaparHTML(os.modelo)}</td>
                    <td><strong style="color:var(--success)">${escaparHTML(os.preco || 'N/A')}</strong></td>
                    <td><span class="badge" style="background-color: var(--success-bg); color: var(--success); border: 1px solid var(--success); margin-bottom: 5px;">RESOLVIDO</span><br><span class="log-user">@${os.concluidaPor}</span> em ${os.dataConclusao}</td>
                `;
                concludedBody.appendChild(tr);
            });
        }
    }

    // 3. Renderizar Tabela O.S. Excluídas
    const deletedBody = document.getElementById("deleted-os-tbody");
    if(deletedBody) {
        deletedBody.innerHTML = "";
        if (historico.excluidas.length === 0) {
            deletedBody.innerHTML = `<tr><td colspan="5" class="empty-message">Nenhuma exclusão registrada.</td></tr>`;
        } else {
            historico.excluidas.forEach(os => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${escaparHTML(os.cliente)}</td>
                    <td>${escaparHTML(os.placa)}</td>
                    <td>${escaparHTML(os.modelo)}</td>
                    <td><strong style="color:var(--error)">${escaparHTML(os.preco || 'N/A')}</strong></td>
                    <td><span class="badge" style="background-color: var(--error-bg); color: var(--error); border: 1px solid var(--error); margin-bottom: 5px;">CANCELADO</span><br><span style="color: var(--error);">@${os.excluidaPor}</span> em ${os.dataExclusao}</td>
                `;
                deletedBody.appendChild(tr);
            });
        }
    }
}

/* ==========================================================================
   8. UTILITÁRIOS (VALIDADORES E ACESSO A DADOS)
   ========================================================================== */

function obterDados(chave) {
    const dados = localStorage.getItem(chave);
    return dados ? JSON.parse(dados) : [];
}

function salvarDados(chave, objeto) {
    localStorage.setItem(chave, JSON.stringify(objeto));
}

function marcarErroCampo(inputElement, errorSpanId, mensagem) {
    inputElement.classList.add("invalid-field");
    const errorSpan = document.getElementById(errorSpanId);
    if (errorSpan) {
        errorSpan.classList.add("visible");
        if (mensagem) {
            errorSpan.textContent = mensagem;
        }
    }
}

function removerErrosFormulario(formElement) {
    formElement.querySelectorAll("input, textarea").forEach(input => input.classList.remove("invalid-field"));
    formElement.querySelectorAll(".error-msg").forEach(err => err.classList.remove("visible"));
}

function exibirFeedbackSucesso(alertId) {
    const alerta = document.getElementById(alertId);
    if (alerta) {
        alerta.classList.remove("hidden");
        setTimeout(() => alerta.classList.add("hidden"), 4000);
    }
}

function formatarDataBr(dataString) {
    if (!dataString) return "";
    const partes = dataString.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.innerText = texto;
    return div.innerHTML;
}

// Validador de CPF da Receita Federal
function validarCPF(cpf) {
    const limpo = cpf.replace(/\D/g, "");
    if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
    
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i)) * (10 - i);
    let resto = 11 - (soma % 11);
    let dv1 = (resto === 10 || resto === 11) ? 0 : resto;
    if (dv1 !== parseInt(limpo.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i)) * (11 - i);
    resto = 11 - (soma % 11);
    let dv2 = (resto === 10 || resto === 11) ? 0 : resto;
    if (dv2 !== parseInt(limpo.charAt(10))) return false;
    
    return true;
}
