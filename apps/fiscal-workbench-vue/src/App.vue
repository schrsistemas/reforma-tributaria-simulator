<script setup lang="ts">
import { ref } from "vue";
const activeArea = ref("evidence");
const areas = [
  { id: "evidence", label: "Evidências normativas" },
  { id: "rules", label: "Regras tributárias" },
  { id: "impacts", label: "Impactos no ERP" },
  { id: "audit", label: "Auditoria" }
];
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">FISCAL INTELLIGENCE HUB</p>
        <h1>Workbench fiscal</h1>
        <p class="muted">Governança normativa, evidências e engenharia tributária.</p>
      </div>
      <span class="status">Estrutura inicial</span>
    </header>
    <nav class="tabs" aria-label="Módulos fiscais">
      <button v-for="area in areas" :key="area.id"
        :class="{ active: activeArea === area.id }"
        @click="activeArea = area.id">{{ area.label }}</button>
    </nav>
    <section class="panel">
      <template v-if="activeArea === 'evidence'">
        <h2>Central de evidências</h2>
        <p>Publicações oficiais com URL de origem, publicação, hash, versão e estado de revisão.</p>
        <div class="notice">Evidência coletada não será convertida automaticamente em regra fiscal executável.</div>
      </template>
      <template v-else-if="activeArea === 'rules'">
        <h2>Catálogo de regras</h2>
        <p>IBS, CBS e Imposto Seletivo terão versões, vigência, obrigatoriedade e referências independentes.</p>
      </template>
      <template v-else-if="activeArea === 'impacts'">
        <h2>Impactos no ERP</h2>
        <p>Alterações normativas relacionadas a documentos, leiautes, rotinas, integrações e testes.</p>
      </template>
      <template v-else>
        <h2>Trilha de auditoria</h2>
        <p>Consultas, aprovações, publicações e alterações vinculadas a ator, tenant, data e correlação.</p>
      </template>
      <p class="footnote">Interface estrutural. A conexão autenticada com a API será habilitada em etapa posterior.</p>
    </section>
  </main>
</template>
