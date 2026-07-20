# Kit de Manutenção e Manual do Usuário
**Projeto:** MotorTech — Sistema de Centro Automotivo & Quadro de Controle  
**Responsável:** Aluno 03 — LUCAS SANTOS  

---

## 1. REGISTRO NO KIT DE MANUTENÇÃO (PREVENTIVAS E CONTROLE DE RISCO)

Este documento registra formalmente as ações de engenharia preventiva executadas no portal **MotorTech** para mitigar riscos operacionais, perda de dados e problemas de manutenção técnica.

| Chamado | Risco Identificado | Ação Preventiva Aplicada no Sistema | Evidência / Arquivos Modificados |
| :--- | :--- | :--- | :--- |
| **CH-01** | **Ação crítica sem confirmação**: Usuário apagar, alterar ou enviar solicitações de orçamento ou ordens de serviço por engano, resultando em retrabalho e falhas com clientes. | Adicionados pop-ups nativos de confirmação (`window.confirm`) antes de salvar novas O.S., atualizar alterações, concluir serviços, rejeitar orçamentos ou deletar colaboradores. Adicionadas também orientações textuais em itálico nos formulários de cadastro e edição. | `index.html` (linhas 223, 283, 535) e `script.js` (funções `btnSaveConfirmOrc`, `formApproveOrc`, `formOS.submit`, `formEdit.submit`, `concluirOS`, `removerOS`, `rejeitarOrcamento`, `removerFuncionario`). |
| **CH-02** | **Perda de dados por pane no ambiente**: Dados da oficina salvos exclusivamente no `localStorage` do navegador correm risco de serem limpos no histórico do usuário ou perdidos em caso de falha de hardware. | Implementado módulo completo de **Backup e Contingência** local na aba de Histórico, com exportação de dados em lote no formato `.json` e importação de arquivo para restauração integral do banco local. | `index.html` (linhas 351-381) e `script.js` (função `configurarBackup` e chamada no `inicializarApp`). |
| **CH-03** | **Dificuldade de manutenção futura**: Falta de modularidade, comentários escassos e funções não documentadas no código fonte dificultavam a localização de regras de validação ou mensagens de erro. | Reorganização e padronização do código fonte com comentários em blocos bem definidos, documentação de funções críticas utilizando o padrão **JSDoc** e **centralização de todos os diálogos, mensagens de confirmação e regras de tamanho mínimo em um objeto central de configuração (`CONFIG_SISTEMA`)** no início do script. | `script.js` (criação da constante `CONFIG_SISTEMA` nas linhas 14-45, e substituição de strings rígidas por referências ao objeto nas funções de formulários, backup e exclusões) e `style.css` (comentários de seção). |

---

## 2. FICHA TÉCNICA E PROCEDIMENTO DE CONTINGÊNCIA (CH-02)

- **Procedimento:** Backup e Contingência Local (Exportação e Importação JSON).  
- **Frequência Recomendada:** Diária (ao término do expediente de trabalho) ou após alterações de grande volume de ordens de serviço.  
- **Responsável:** Mecânico Chefe / Administrador do Sistema (Gerente).  
- **Impacto no Negócio:** Garante que, caso o computador apresente falha de hardware ou o navegador limpe os dados locais, a oficina possa reaver todo o histórico de ordens de serviço, orçamentos e colaboradores cadastrados em menos de 1 minuto.

---

## 3. MANUAL DO USUÁRIO (INSTRUÇÕES PARA MECÂNICOS E ATENDENTES)

Mecânicos e colaboradores da **MotorTech**, utilizem este manual para operar as novas ferramentas de segurança e prevenção de erros.

### 3.1. Ações Críticas e Confirmações (CH-01)
Para evitar o apagamento de dados por cliques acidentais, o sistema agora exige sua confirmação explícita antes de concluir as seguintes ações:
1. **Enviar Solicitação de Orçamento:** Após clicar em "Revisar e Salvar", na tela de revisão, ao clicar em "Confirmar e Registrar", o navegador solicitará uma confirmação de gravação.
2. **Criar Nova Ordem de Serviço (O.S.):** Ao clicar em "Salvar Ordem de Serviço", você deve confirmar a abertura da O.S. no quadro.
3. **Salvar Alterações (Edição):** Ao alterar uma O.S. ativa no botão "Editar" e clicar em "Salvar Alterações", confirme a atualização dos dados na janela do navegador.
4. **Concluir ou Excluir Serviço:** Ações no quadro digital (botões "✔ Concluir" e "✖ Excluir") exibirão um aviso na tela. Apenas confirme se o serviço estiver realmente pronto ou cancelado.

> [!IMPORTANT]
> **Atenção:** Se você clicar em "Cancelar" na janela de aviso do navegador, a ação será interrompida imediatamente e nenhum dado será modificado.

---

### 3.2. Procedimento de Backup e Restauração de Dados (CH-02)

Para realizar a cópia de segurança dos dados ou transferir o sistema para outro computador:

#### Como Realizar o Backup (Exportação)
1. Clique no menu superior do portal e selecione a aba **Histórico**.
2. Na coluna esquerda, localize o card **💾 Backup & Contingência**.
3. Clique no botão azul **📥 Exportar Backup (JSON)**.
4. O navegador fará o download automático de um arquivo nomeado como `motortech_backup_AAAA-MM-DD.json` (onde AAAA-MM-DD é a data atual).
5. Salve este arquivo em um local seguro (por exemplo, em um pendrive ou em uma pasta de nuvem como Google Drive).

#### Como Restaurar o Backup (Importação)
1. Vá até a aba **Histórico** -> Card **💾 Backup & Contingência**.
2. Sob a seção "Restaurar Backup (JSON)", clique em **Escolher arquivo** (ou no campo seletor de arquivos).
3. Selecione o arquivo de backup `.json` correspondente à última gravação realizada.
4. Clique no botão laranja **⚡ Confirmar Restauração**.
5. O sistema exibirá um aviso alertando que a restauração substituirá todos os dados atuais. Confirme clicando em **OK** no prompt.
6. A página atualizará automaticamente os cartões do quadro e os logs do histórico com as informações salvas no arquivo.
