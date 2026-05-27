/**
 * ==========================================================================
 * MotorTech - Sistema de Oficina Mecânica & Quadro de Controle
 * Lógica da Aplicação com Login, Permissões e Histórico
 * ==========================================================================
 */

const LOCAL_STORAGE_KEY_OS = "motortech_os";
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
        mainGrid.style.gridTemplateColumns = "1.4fr 1fr";
        badgePerfil.textContent = "Admin";
        badgePerfil.style.backgroundColor = "rgba(255, 107, 0, 0.2)";
        badgePerfil.style.color = "var(--accent)";
    } else {
        // Modo Funcionário: Esconde a aba e a coluna
        navFuncionarios.style.display = "none";
        colFuncionarios.style.display = "none";
        mainGrid.style.gridTemplateColumns = "1fr"; // Ocupa a tela toda com as O.S.
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

    // Máscara dinâmica de CPF
    cpfInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 3) val = val.replace(/^(\d{3})(\d)/, "$1.$2");
        if (val.length > 6) val = val.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
        if (val.length > 9) val = val.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
        e.target.value = val.substring(0, 14);
    });

    // Submissão Nova O.S.
    formOS.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const clienteInput = document.getElementById("os-cliente");
        const placaInput = document.getElementById("os-placa");
        const modeloInput = document.getElementById("os-modelo");
        const problemaInput = document.getElementById("os-problema");

        removerErrosFormulario(formOS);

        let formValido = true;
        if (!clienteInput.value.trim()) { marcarErroCampo(clienteInput, "error-cliente"); formValido = false; }
        if (!placaInput.value.trim()) { marcarErroCampo(placaInput, "error-placa"); formValido = false; }
        if (!modeloInput.value.trim()) { marcarErroCampo(modeloInput, "error-modelo"); formValido = false; }
        if (!problemaInput.value.trim()) { marcarErroCampo(problemaInput, "error-problema"); formValido = false; }

        if (formValido) {
            const novaOS = {
                id: Date.now(),
                cliente: clienteInput.value.trim(),
                placa: placaInput.value.trim().toUpperCase(),
                modelo: modeloInput.value.trim(),
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
        const problemaInput = document.getElementById("edit-os-problema");

        removerErrosFormulario(formEdit);
        let formValido = true;

        if (!clienteInput.value.trim()) { marcarErroCampo(clienteInput, "error-edit-cliente"); formValido = false; }
        if (!placaInput.value.trim()) { marcarErroCampo(placaInput, "error-edit-placa"); formValido = false; }
        if (!modeloInput.value.trim()) { marcarErroCampo(modeloInput, "error-edit-modelo"); formValido = false; }
        if (!problemaInput.value.trim()) { marcarErroCampo(problemaInput, "error-edit-problema"); formValido = false; }

        if (formValido) {
            const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
            const osIndex = listaOS.findIndex(os => os.id === idOS);
            
            if (osIndex > -1) {
                listaOS[osIndex].cliente = clienteInput.value.trim();
                listaOS[osIndex].placa = placaInput.value.trim().toUpperCase();
                listaOS[osIndex].modelo = modeloInput.value.trim();
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
    const listaOS = obterDados(LOCAL_STORAGE_KEY_OS);
    const listaFunc = obterDados(LOCAL_STORAGE_KEY_FUNC);

    document.getElementById("count-os").textContent = listaOS.length;
    document.getElementById("count-func").textContent = listaFunc.length;

    renderizarPainelOS(listaOS);
    
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
                <span class="badge badge-plate">${escaparHTML(os.placa)}</span>
                <span class="badge badge-car">${escaparHTML(os.modelo)}</span>
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
            concludedBody.innerHTML = `<tr><td colspan="4" class="empty-message">Nenhuma O.S. concluída no sistema.</td></tr>`;
        } else {
            historico.concluidas.forEach(os => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${escaparHTML(os.cliente)}</td>
                    <td>${escaparHTML(os.placa)}</td>
                    <td>${escaparHTML(os.modelo)}</td>
                    <td><span class="log-user">@${os.concluidaPor}</span> em ${os.dataConclusao}</td>
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
            deletedBody.innerHTML = `<tr><td colspan="4" class="empty-message">Nenhuma exclusão registrada.</td></tr>`;
        } else {
            historico.excluidas.forEach(os => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${escaparHTML(os.cliente)}</td>
                    <td>${escaparHTML(os.placa)}</td>
                    <td>${escaparHTML(os.modelo)}</td>
                    <td><span style="color: var(--error);">@${os.excluidaPor}</span> em ${os.dataExclusao}</td>
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

function marcarErroCampo(inputElement, errorSpanId) {
    inputElement.classList.add("invalid-field");
    const errorSpan = document.getElementById(errorSpanId);
    if (errorSpan) errorSpan.classList.add("visible");
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
