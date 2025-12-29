import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { LayoutDashboard, CheckCircle2, Clock, AlertCircle, Plus, Trash2, Save, Download, LogOut, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  '이행완료': '#10b981',
  '진행중': '#f59e0b',
  '미이행': '#ef4444'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [directives, setDirectives] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ task: '', dept: '', progress: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const fetchDirectives = async () => {
    const { data } = await supabase.from('directives').select('*').order('created_at', { ascending: true });
    if (data) setDirectives(data);
  };

  useEffect(() => { if (user) fetchDirectives(); }, [user]);

  const calculateStatus = (progress) => {
    const p = parseInt(progress);
    if (p < 20) return '미이행';
    if (p >= 20 && p < 90) return '진행중';
    if (p >= 90) return '이행완료';
    return '미이행';
  };

  const generateSerialNo = () => {
    const currentYear = new Date().getFullYear();
    const thisYearItems = directives.filter(d => new Date(d.created_at).getFullYear() === currentYear);
    return `${currentYear}-${thisYearItems.length + 1}`;
  };

  // --- [엑셀 다운로드 기능 추가] ---
  const downloadExcel = () => {
    const excelData = directives.map(item => ({
      "지시번호": item.serial_no || '-',
      "지시사항": item.task,
      "담당부서": item.dept,
      "진척도(%)": item.progress,
      "상태": item.status,
      "등록일": new Date(item.created_at).toLocaleDateString()
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "이행현황");
    XLSX.writeFile(workbook, `ed-dash_현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleProgressChange = (val, setter, state) => {
    const num = parseInt(val);
    setter({ ...state, progress: num, status: calculateStatus(num) });
  };

  const handleUpdate = async () => {
    const finalStatus = calculateStatus(editForm.progress);
    const { error } = await supabase.from('directives').update({ 
      task: editForm.task, dept: editForm.dept, progress: editForm.progress, status: finalStatus 
    }).eq('id', editingId);
    if (!error) { setEditingId(null); fetchDirectives(); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const status = calculateStatus(newTask.progress);
    const serial_no = generateSerialNo();
    const { error } = await supabase.from('directives').insert([{ ...newTask, status, serial_no }]);
    if (!error) {
      setIsModalOpen(false);
      setNewTask({ task: '', dept: '', progress: 0 });
      fetchDirectives();
    }
  };

  const getDeptData = () => {
    const deptMap = {};
    directives.forEach(item => {
      if (!deptMap[item.dept]) deptMap[item.dept] = { name: item.dept, totalProgress: 0, count: 0 };
      deptMap[item.dept].totalProgress += parseInt(item.progress || 0);
      deptMap[item.dept].count += 1;
    });
    return Object.values(deptMap).map(d => ({ name: d.name, 이행률: Math.round(d.totalProgress / d.count) }));
  };

  const doneCount = directives.filter(d => d.status === '이행완료').length;
  const doingCount = directives.filter(d => d.status === '진행중').length;
  const todoCount = directives.filter(d => d.status === '미이행').length;
  const pieData = [{ name: '이행완료', value: doneCount, color: STATUS_COLORS['이행완료'] }, { name: '진행중', value: doingCount, color: STATUS_COLORS['진행중'] }, { name: '미이행', value: todoCount, color: STATUS_COLORS['미이행'] }];

  if (!user) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="text-white" size={30} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 italic uppercase">ed-dash</h1>
          <p className="text-slate-400 text-sm font-bold mt-2">
            {isSignUp ? "새로운 계정을 생성합니다" : "관리자 시스템에 접속하세요"}
          </p>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) alert("회원가입 실패: " + error.message);
            else alert("가입 성공! 이메일 인증이 필요할 수 있습니다.");
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
          }
        }} className="space-y-4">
          <input type="email" placeholder="이메일 주소" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호 (6자리 이상)" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
          
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all uppercase">
            {isSignUp ? "계정 만들기" : "접속하기"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-slate-400 hover:text-blue-600 font-bold text-sm underline underline-offset-4"
          >
            {isSignUp ? "이미 계정이 있으신가요? 로그인" : "처음이신가요? 회원가입"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg"><LayoutDashboard size={20} className="text-white" /></div>
          <span className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">ed-dash admin</span>
        </div>
        {/* 접속 계정 정보 추가 */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500">{user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut size={22}/></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto mt-10 px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight underline decoration-blue-500 decoration-4 underline-offset-8">지시사항 이행 현황</h2>
          </div>
          <div className="flex gap-3">
            {/* --- [엑셀 저장 버튼 추가] --- */}
            <button onClick={downloadExcel} className="bg-white text-emerald-600 border border-emerald-100 px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-50 shadow-sm transition-all">
              <Download size={20}/> 엑셀 저장
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-blue-700 transition-all active:scale-95">
              <Plus size={22}/> 신규 등록
            </button>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 uppercase tracking-wider">부서별 이행률 현황</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDeptData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 700}} dy={10} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="이행률" fill="#3b82f6" radius={[6, 6, 6, 6]} barSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-slate-800 mb-4 w-full uppercase tracking-wider">전체 이행률</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={75} dataKey="value" paddingAngle={8}>
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 font-black text-[10px] text-slate-400">
              {pieData.map(d => <div key={d.name} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: d.color}}></div>{d.name}</div>)}
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card title="이행완료" count={doneCount} color="text-emerald-600" bgColor="bg-emerald-50" icon={<CheckCircle2/>} />
          <Card title="진행중" count={doingCount} color="text-amber-500" bgColor="bg-amber-50" icon={<Clock/>} />
          <Card title="미이행" count={todoCount} color="text-red-500" bgColor="bg-red-50" icon={<AlertCircle/>} />
        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-6 text-xs font-bold text-slate-400 uppercase w-32">지시번호</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase">지시사항</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase">담당부서</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase text-center w-64">진척도</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase text-center">상태</th>
                <th className="p-6 text-xs font-bold text-slate-400 uppercase text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {directives.map((item) => (
                <tr key={item.id} onDoubleClick={() => { setEditingId(item.id); setEditForm({...item}); }} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                  <td className="p-6 font-black text-slate-400 text-sm">{item.serial_no || '-'}</td>
                  <td className="p-6">
                    {editingId === item.id ? (
                      <input className="w-full p-2 border-2 border-blue-500 rounded-lg outline-none font-bold" value={editForm.task} onChange={e => setEditForm({...editForm, task: e.target.value})} />
                    ) : ( <span className="font-bold text-slate-700">{item.task}</span> )}
                  </td>
                  <td className="p-6 text-slate-500 font-semibold italic">
                    {editingId === item.id ? (
                      <input className="w-full p-2 border border-slate-200 rounded-lg" value={editForm.dept} onChange={e => setEditForm({...editForm, dept: e.target.value})} />
                    ) : ( item.dept )}
                  </td>
                  <td className="p-6 text-center">
                    {editingId === item.id ? (
                      <div className="flex flex-col items-center gap-1">
                        <input type="range" min="0" max="100" className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" value={editForm.progress} onChange={e => handleProgressChange(e.target.value, setEditForm, editForm)} />
                        <span className="text-xs font-black text-blue-600">{editForm.progress}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full" style={{ width: `${item.progress}%`, backgroundColor: STATUS_COLORS[item.status] }}></div>
                        </div>
                        <span className="text-xs font-black">{item.progress}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-center">
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black" style={{ backgroundColor: `${STATUS_COLORS[item.status]}15`, color: STATUS_COLORS[item.status] }}>{item.status}</span>
                  </td>
                  <td className="p-6 text-center">
                    {editingId === item.id ? (
                      <button onClick={handleUpdate} className="bg-emerald-500 text-white p-2 rounded-lg"><Save size={18}/></button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); if(confirm('삭제하시겠습니까?')) supabase.from('directives').delete().eq('id', item.id).then(() => fetchDirectives()); }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* 신규 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-white/20 text-center">
            <h3 className="text-2xl font-black text-slate-800 mb-8 italic tracking-widest uppercase underline decoration-blue-500 underline-offset-8">New Entry</h3>
            <form onSubmit={handleAdd} className="space-y-6 text-left">
              <div>
                <label className="text-xs font-black text-slate-400 ml-2 mb-2 block uppercase">지시 내용</label>
                <input className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-medium" placeholder="내용 입력" required value={newTask.task} onChange={e => setNewTask({...newTask, task: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 ml-2 mb-2 block uppercase">담당 부서</label>
                <input className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-medium" placeholder="부서명" required value={newTask.dept} onChange={e => setNewTask({...newTask, dept: e.target.value})} />
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Progress</label>
                    <span className="px-4 py-1 rounded-full text-xs font-black text-white" style={{backgroundColor: STATUS_COLORS[calculateStatus(newTask.progress)]}}>{newTask.progress}% ({calculateStatus(newTask.progress)})</span>
                </div>
                <input type="range" min="0" max="100" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" value={newTask.progress} onChange={e => handleProgressChange(e.target.value, setNewTask, newTask)} />
                <div className="flex justify-between text-[10px] text-slate-300 font-bold mt-2"><span>0%</span><span>50%</span><span>100%</span></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl hover:bg-blue-700 transition-all mt-4 uppercase">Save Entry</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full text-slate-400 font-bold text-sm mt-2">CANCEL</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, count, color, bgColor, icon }) {
  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center group transition-all hover:shadow-lg">
      <div><p className="text-slate-400 text-[10px] font-black mb-1 uppercase tracking-widest">{title}</p><p className={`text-4xl font-black ${color}`}>{count}<span className="text-sm ml-1 font-bold">건</span></p></div>
      <div className={`${bgColor} ${color} p-5 rounded-[1.5rem] group-hover:rotate-12 transition-transform`}>{icon}</div>
    </div>
  );
}