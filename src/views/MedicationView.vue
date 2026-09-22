<script setup lang="ts">
import { computed, ref } from 'vue'
import DoseItem from '../components/medication/DoseItem.vue'
import PlanForm from '../components/medication/PlanForm.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { useFamilyStore } from '../stores/useFamilyStore'
import type { MedicationPlan, PlanInput } from '../types'
import { formatDate } from '../utils/date'
import { formatPercent } from '../utils/format'
import { planEditImpact } from '../utils/plan'

const store = useFamilyStore()
const showForm = ref(false)
const editingPlan = ref<MedicationPlan | null>(null)

const todayDoses = computed(() => store.todayDoses)
const compliance = computed(() => store.compliance7)
const plans = computed(() => store.state.plans)

const modalTitle = computed(() => (editingPlan.value ? '编辑用药计划' : '新建用药计划'))

function memberName(plan: MedicationPlan) {
  return store.getMember(plan.memberId)?.name ?? '—'
}
function medicineName(plan: MedicationPlan) {
  return store.getMedicine(plan.medicineId)?.name ?? '—'
}

function openCreate() {
  editingPlan.value = null
  showForm.value = true
}

function openEdit(plan: MedicationPlan) {
  editingPlan.value = plan
  showForm.value = true
}

function onSave(data: PlanInput) {
  const plan = editingPlan.value
  if (!plan) {
    store.addPlan(data)
    showForm.value = false
    return
  }
  // Explain what happens to today's existing logs before committing.
  const impact = planEditImpact(plan, data, store.state.logs)
  if (impact.loggedRemoved.length) {
    const times = impact.removed.join('、')
    const ok = window.confirm(
      `时间点 ${times} 今日已有 ${impact.loggedRemoved.length} 条服药记录。` +
        '修改后这些记录会保留在历史记录与依从率统计中，但不再出现在今日待服列表。确定保存吗？',
    )
    if (!ok) return
  }
  store.updatePlan(plan.id, data)
  showForm.value = false
}

function onTogglePause(plan: MedicationPlan) {
  if (!plan.paused) {
    const ok = window.confirm('暂停后该计划在暂停期间不再生成今日待服项，历史服药记录会保留。确定暂停吗？')
    if (!ok) return
  }
  store.setPlanPaused(plan.id, !plan.paused)
}

function onDelete(plan: MedicationPlan) {
  if (window.confirm('确定删除该用药计划吗？')) {
    store.deletePlan(plan.id)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">用药提醒</h1>
      <button type="button" class="btn btn-primary" @click="openCreate">＋ 新建用药计划</button>
    </div>

    <!-- Compliance -->
    <section class="card compliance-card">
      <div>
        <div class="compliance-value">{{ formatPercent(compliance.rate) }}</div>
        <div class="compliance-label">近 7 天用药依从率</div>
      </div>
      <div class="compliance-detail">
        <span>已服用 {{ compliance.taken }} 次</span>
        <span>已跳过 {{ compliance.skipped }} 次</span>
      </div>
    </section>

    <!-- Today's doses -->
    <section class="card">
      <div class="section-head">
        <h3>今日待服药</h3>
        <span class="muted">共 {{ todayDoses.length }} 项</span>
      </div>
      <template v-if="todayDoses.length">
        <DoseItem
          v-for="d in todayDoses"
          :key="d.planId + d.time"
          :dose="d"
          @mark="(s) => store.logDose(d.planId, d.time, s)"
        />
      </template>
      <EmptyState v-else icon="💤" text="今日暂无服药安排" />
    </section>

    <!-- Plans -->
    <section class="card">
      <div class="section-head">
        <h3>用药计划（{{ plans.length }}）</h3>
      </div>
      <template v-if="plans.length">
        <div v-for="p in plans" :key="p.id" class="plan-item" :class="{ 'plan-paused': p.paused }">
          <div class="plan-info">
            <div class="plan-title">
              {{ memberName(p) }} · {{ medicineName(p) }}
              <span v-if="p.paused" class="pause-badge">已暂停</span>
            </div>
            <div class="plan-meta">
              <span>剂量 {{ p.dosage || '—' }}</span>
              <span>时间 {{ p.times.join(' / ') }}</span>
              <span>{{ formatDate(p.startDate) }} ~ {{ formatDate(p.endDate) }}</span>
            </div>
          </div>
          <div class="plan-actions">
            <button type="button" class="btn btn-sm btn-ghost" @click="onTogglePause(p)">
              {{ p.paused ? '恢复' : '暂停' }}
            </button>
            <button type="button" class="btn btn-sm btn-ghost" @click="openEdit(p)">编辑</button>
            <button type="button" class="btn btn-sm btn-danger-ghost" @click="onDelete(p)">删除</button>
          </div>
        </div>
      </template>
      <EmptyState v-else icon="📅" text="暂无用药计划" />
    </section>
  </div>

  <BaseModal v-if="showForm" :title="modalTitle" @close="showForm = false">
    <PlanForm :plan="editingPlan" @save="onSave" @close="showForm = false" />
  </BaseModal>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
}
.compliance-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.compliance-value {
  font-size: 32px;
  font-weight: 800;
  color: var(--success-color);
}
.compliance-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.compliance-detail {
  display: flex;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.section-head h3 {
  margin: 0;
}
.muted {
  color: var(--text-secondary);
  font-size: 13px;
}
.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.plan-item:last-child {
  border-bottom: none;
}
.plan-paused {
  opacity: 0.6;
}
.plan-title {
  font-weight: 600;
  color: var(--text-primary);
}
.pause-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--warning-color);
  background: rgba(243, 156, 18, 0.15);
  vertical-align: middle;
}
.plan-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.plan-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
