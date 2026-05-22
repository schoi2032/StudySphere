        import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
        import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
        import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
        
        // --- FIREBASE CONFIG ---
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'studysphere-demo-id';

        // --- NEW CURRICULUM: Grade -> Unit -> Chapter -> Lesson ---
        const CURRICULUM = {
            grades: [
                {
                    id: "grade8",
                    title: "8th Grade Math",
                    recommended: true,
                    color: "bg-blue-50 border-blue-200",
                    accent: "bg-blue-500",
                    units: [
                        {
                            id: "g8u1",
                            title: "Unit 1: Algebra Foundations",
                            chapters: [
                                {
                                    id: "g8u1c1",
                                    title: "Chapter 1: Variables & Expressions",
                                    lessons: [
                                        { id: "l1", title: "Intro to variables", type: "lesson", duration: "5 min" },
                                        { id: "l2", title: "Evaluating expressions", type: "lesson", duration: "8 min" },
                                        { id: "q1", title: "Chapter 1 Quiz", type: "quiz", duration: "10 min" }
                                    ]
                                },
                                {
                                    id: "g8u1c2",
                                    title: "Chapter 2: Solving Equations",
                                    lessons: [
                                        { id: "l3", title: "One-step equations", type: "lesson", duration: "10 min" },
                                        { id: "l4", title: "Two-step equations", type: "lesson", duration: "12 min" },
                                        { id: "t1", title: "Chapter 2 Test", type: "test", duration: "20 min" }
                                    ]
                                }
                            ]
                        },
                        {
                            id: "g8u2",
                            title: "Unit 2: Geometry & Transformations",
                            chapters: [
                                {
                                    id: "g8u2c1",
                                    title: "Chapter 1: The Coordinate Plane",
                                    lessons: [
                                        { id: "l5", title: "Plotting points", type: "lesson", duration: "6 min" },
                                        { id: "l6", title: "Quadrants", type: "lesson", duration: "5 min" }
                                    ]
                                },
                                {
                                    id: "g8u2c2",
                                    title: "Chapter 2: Transformations",
                                    lessons: [
                                        { id: "l7", title: "Translations", type: "lesson", duration: "8 min" },
                                        { id: "l8", title: "Rotations", type: "lesson", duration: "8 min" },
                                        { id: "t2", title: "Unit 2 Final Test", type: "test", duration: "25 min" }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    id: "grade9",
                    title: "9th Grade Math",
                    recommended: false,
                    color: "bg-emerald-50 border-emerald-200",
                    accent: "bg-emerald-500",
                    units: [
                        {
                            id: "g9u1",
                            title: "Unit 1: Linear Equations",
                            chapters: [
                                {
                                    id: "g9u1c1",
                                    title: "Chapter 1: Slope & Intercepts",
                                    lessons: [
                                        { id: "l9", title: "Finding slope", type: "lesson", duration: "10 min" },
                                        { id: "l10", title: "Y-intercepts", type: "lesson", duration: "12 min" }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // --- GLOBAL STATE ---
        const state = {
            user: null,
            username: '',
            completedLessons: [],
            currentView: 'dashboard',
            activeGrade: null,
            activeUnit: null,
            activeChapter: null,
            activeLesson: null,
            nextUpData: null,
            unsubscribeFirestore: null
        };

        // --- DOM ELEMENTS ---
        const els = {
            loading: document.getElementById('loading-screen'),
            login: document.getElementById('login-screen'),
            app: document.getElementById('main-app'),
            content: document.getElementById('app-content'),
            loginForm: document.getElementById('login-form'),
            usernameInput: document.getElementById('username-input'),
            loadingText: document.getElementById('loading-text'),
            navUsername: document.getElementById('nav-username'),
            navInitial: document.getElementById('nav-initial'),
            celebration: document.getElementById('celebration-overlay')
        };

        // --- INITIALIZATION & AUTH ---
        async function init() {
            lucide.createIcons();
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) { console.error("Auth error:", error); }

            onAuthStateChanged(auth, (u) => {
                state.user = u;
                if (u && !state.username) showLogin();
            });
        }

        // --- EVENT LISTENERS ---
        els.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = els.usernameInput.value.trim();
            if (name) {
                state.username = name;
                els.navUsername.textContent = `${name}'s Notebook`;
                els.navInitial.textContent = name.charAt(0).toUpperCase();
                startFirestoreSync();
            }
        });

        // --- DATA SYNC ---
        function startFirestoreSync() {
            if (!state.user || !state.username) return;
            showLoading(`Opening ${state.username}'s notebook...`);

            if (state.unsubscribeFirestore) state.unsubscribeFirestore();
            const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'userProgress'), state.username);
            
            state.unsubscribeFirestore = onSnapshot(docRef, (snap) => {
                state.completedLessons = snap.exists() ? (snap.data().completed || []) : [];
                
                els.loading.classList.add('hidden');
                els.login.classList.add('hidden');
                els.app.classList.remove('hidden');
                renderView();
            }, (error) => {
                console.error("Firestore error:", error);
                showLogin();
            });
        }

        // --- ACTION HANDLERS ---
        window.app = {
            navigate: (view, gradeIdx = null, unitIdx = null, chapterIdx = null, lessonIdx = null) => {
                window.scrollTo(0, 0);
                state.currentView = view;
                
                if (view === 'nextUp' && state.nextUpData) {
                    state.activeGrade = state.nextUpData.grade;
                    state.activeUnit = state.nextUpData.unit;
                    state.activeChapter = state.nextUpData.chapter;
                    state.activeLesson = state.nextUpData.lesson;
                    state.currentView = 'lesson';
                } else if (view === 'grade' && gradeIdx !== null) {
                    state.activeGrade = CURRICULUM.grades[gradeIdx];
                } else if (view === 'unit' && gradeIdx !== null && unitIdx !== null) {
                    state.activeGrade = CURRICULUM.grades[gradeIdx];
                    state.activeUnit = state.activeGrade.units[unitIdx];
                } else if (view === 'lesson' && gradeIdx !== null && unitIdx !== null && chapterIdx !== null && lessonIdx !== null) {
                    state.activeGrade = CURRICULUM.grades[gradeIdx];
                    state.activeUnit = state.activeGrade.units[unitIdx];
                    state.activeChapter = state.activeUnit.chapters[chapterIdx];
                    state.activeLesson = state.activeChapter.lessons[lessonIdx];
                }
                
                renderView();
            },
            
            markComplete: async (lessonId) => {
                if (!state.user || !state.username) return;
                
                if (!state.completedLessons.includes(lessonId)) {
                    state.completedLessons.push(lessonId);
                }
                
                // Celebration logic (if all lessons in the current chapter are done)
                if (state.activeChapter) {
                    const chapterLessonIds = state.activeChapter.lessons.map(l => l.id);
                    const completedInChapter = chapterLessonIds.filter(id => state.completedLessons.includes(id)).length;
                    if (completedInChapter === chapterLessonIds.length) {
                        triggerCelebration();
                    }
                }

                renderView();

                const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'userProgress'), state.username);
                await setDoc(docRef, { completed: state.completedLessons }, { merge: true });
            }
        };

        function triggerCelebration() {
            els.celebration.classList.remove('hidden');
            setTimeout(() => els.celebration.classList.add('hidden'), 3000);
        }

        // --- HELPER FUNCTIONS ---
        function showLoading(text) {
            els.loadingText.textContent = text;
            els.loading.classList.remove('hidden');
            els.login.classList.add('hidden');
            els.app.classList.add('hidden');
        }

        function showLogin() {
            els.loading.classList.add('hidden');
            els.login.classList.remove('hidden');
            els.app.classList.add('hidden');
            els.usernameInput.focus();
        }

        function getNextUp() {
            for (const grade of CURRICULUM.grades) {
                for (const unit of grade.units) {
                    for (const chapter of unit.chapters) {
                        for (const lesson of chapter.lessons) {
                            if (!state.completedLessons.includes(lesson.id)) {
                                return { grade, unit, chapter, lesson };
                            }
                        }
                    }
                }
            }
            return null;
        }

        // Gets all lessons recursively from a unit or grade
        function getAllLessons(item) {
            if (item.lessons) return item.lessons;
            if (item.chapters) return item.chapters.flatMap(c => getAllLessons(c));
            if (item.units) return item.units.flatMap(u => getAllLessons(u));
            return [];
        }

        function buildProgressIndicator(lessons) {
            const total = lessons.length;
            const completed = lessons.filter(l => state.completedLessons.includes(l.id)).length;
            
            let iconsHtml = lessons.slice(0, 10).map(l => {
                const isDone = state.completedLessons.includes(l.id);
                if (l.type === 'test' || l.type === 'quiz') {
                    return `<i data-lucide="star" class="w-4 h-4 ${isDone ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}"></i>`;
                }
                return isDone 
                    ? `<div class="w-3 h-3 rounded-full bg-slate-800 shadow-sm"></div>` 
                    : `<div class="w-3 h-3 rounded-full border-2 border-slate-300"></div>`;
            }).join('');
            
            if (lessons.length > 10) iconsHtml += `<span class="text-xs text-slate-400 ml-1">+${lessons.length - 10}</span>`;

            return `
                <div class="flex flex-col gap-1 mt-3">
                    <div class="flex items-center gap-1.5">${iconsHtml}</div>
                    <span class="text-sm font-medium text-slate-500 font-sans">${completed}/${total} lessons complete</span>
                </div>
            `;
        }

        // --- RENDERERS ---
        function renderView() {
            els.content.innerHTML = '';
            
            if (state.currentView === 'dashboard') {
                els.content.innerHTML = generateDashboardHTML();
            } else if (state.currentView === 'grade') {
                els.content.innerHTML = generateGradeHTML();
            } else if (state.currentView === 'unit') {
                els.content.innerHTML = generateUnitHTML();
            } else if (state.currentView === 'lesson') {
                els.content.innerHTML = generateLessonHTML();
            }
            
            els.content.className = `px-6 py-10 ${state.currentView === 'lesson' ? 'max-w-3xl' : 'max-w-4xl'} mx-auto animate-fade-in`;
            lucide.createIcons();
        }

        // 1. Dashboard: Shows Grades
        function generateDashboardHTML() {
            const nextUp = getNextUp();
            state.nextUpData = nextUp;

            let nextUpHtml = '';
            if (nextUp) {
                nextUpHtml = `
                    <div class="relative group cursor-pointer" onclick="window.app.navigate('nextUp')">
                        <div class="absolute -inset-1 bg-yellow-200 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                        <div class="relative bg-[#FFF9C4] p-6 rounded-lg rounded-br-2xl shadow-sm border border-yellow-200 rotate-1 hover:rotate-0 transition-transform duration-300">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="font-handwritten text-xl text-yellow-800 flex items-center gap-2 mb-2">
                                        <i data-lucide="pen-tool" class="w-4 h-4"></i> Continue Learning
                                    </p>
                                    <h3 class="text-xl font-bold text-slate-800">${nextUp.lesson.title}</h3>
                                    <p class="text-slate-600 text-sm mt-1">
                                        ${nextUp.unit.title} <span class="mx-1">→</span> ${nextUp.chapter.title}
                                    </p>
                                </div>
                                <div class="bg-white p-3 rounded-full shadow-sm text-yellow-600">
                                    <i data-lucide="play-circle" class="w-7 h-7"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const gradesHtml = CURRICULUM.grades.map((grade, idx) => {
                const badge = grade.recommended 
                    ? `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide border border-blue-200 mb-3 inline-block">Recommended for you</span>` 
                    : '';

                return `
                <div 
                    onclick="window.app.navigate('grade', ${idx})"
                    class="p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 border-2 bg-white ${grade.color}"
                >
                    ${badge}
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-2xl font-bold text-slate-800">${grade.title}</h3>
                        <div class="p-3 rounded-xl text-white ${grade.accent}">
                            <i data-lucide="book-open" class="w-6 h-6"></i>
                        </div>
                    </div>
                    <div class="font-handwritten text-xl text-slate-500 opacity-80">
                        ${grade.units.length} Units available
                    </div>
                </div>
            `}).join('');

            return `
                <div class="space-y-10">
                    <div>
                        <h1 class="text-4xl font-bold text-slate-800 tracking-tight">StudySphere</h1>
                        <p class="font-handwritten text-2xl text-slate-500 mt-1">Your personal learning journey</p>
                    </div>
                    ${nextUpHtml}
                    <div class="space-y-6">
                        <div class="flex items-center gap-4">
                            <h2 class="text-2xl font-bold text-slate-800">Grade Levels</h2>
                            <div class="h-px bg-slate-200 flex-1"></div>
                        </div>
                        <div class="grid md:grid-cols-2 gap-6">
                            ${gradesHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. Grade View: Shows Units
        function generateGradeHTML() {
            const gradeIdx = CURRICULUM.grades.findIndex(g => g.id === state.activeGrade.id);

            const unitsHtml = state.activeGrade.units.map((unit, unitIdx) => {
                const allLessonsInUnit = getAllLessons(unit);
                const progressHtml = buildProgressIndicator(allLessonsInUnit);

                return `
                    <div 
                        onclick="window.app.navigate('unit', ${gradeIdx}, ${unitIdx})"
                        class="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex justify-between items-center group"
                    >
                        <div>
                            <span class="font-handwritten text-lg text-slate-400 mb-1 block">Unit ${unitIdx + 1}</span>
                            <h2 class="text-2xl font-bold text-slate-800">${unit.title}</h2>
                            ${progressHtml}
                        </div>
                        <div class="text-slate-300 group-hover:text-blue-500 transition-colors">
                            <i data-lucide="chevron-right" class="w-8 h-8"></i>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="space-y-8">
                    <button 
                        onclick="window.app.navigate('dashboard')"
                        class="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium"
                    >
                        <i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Back to Dashboard
                    </button>

                    <div class="pb-6 border-b-2 border-dashed border-slate-200">
                        <h1 class="text-4xl font-bold text-slate-800 mt-1">${state.activeGrade.title} Curriculum</h1>
                        <p class="font-handwritten text-2xl text-slate-500 mt-2">Select a unit to start learning.</p>
                    </div>

                    <div class="space-y-4">
                        ${unitsHtml}
                    </div>
                </div>
            `;
        }

        // 3. Unit View: Shows Chapters & Lessons
        function generateUnitHTML() {
            const gradeIdx = CURRICULUM.grades.findIndex(g => g.id === state.activeGrade.id);
            const unitIdx = state.activeGrade.units.findIndex(u => u.id === state.activeUnit.id);

            const chaptersHtml = state.activeUnit.chapters.map((chapter, chapterIdx) => {
                const isComplete = chapter.lessons.every(l => state.completedLessons.includes(l.id));
                const progressHtml = buildProgressIndicator(chapter.lessons);
                
                const pillsHtml = chapter.lessons.map((lesson, lessonIdx) => {
                    const isDone = state.completedLessons.includes(lesson.id);
                    const isTest = lesson.type === 'test' || lesson.type === 'quiz';
                    
                    let iconHtml = isDone 
                        ? `<i data-lucide="check-circle" class="w-4 h-4 text-green-500"></i>`
                        : isTest 
                            ? `<i data-lucide="star" class="w-4 h-4 text-yellow-500"></i>`
                            : `<i data-lucide="circle" class="w-4 h-4 text-slate-300"></i>`;

                    const btnClass = isDone 
                        ? 'bg-slate-50 border-2 border-slate-200 text-slate-500' 
                        : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-400 hover:shadow-sm';

                    return `
                        <button
                            onclick="window.app.navigate('lesson', ${gradeIdx}, ${unitIdx}, ${chapterIdx}, ${lessonIdx})"
                            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${btnClass}"
                        >
                            ${iconHtml}
                            <span>${lesson.title}</span>
                        </button>
                    `;
                }).join('');

                const lineHtml = chapterIdx !== state.activeUnit.chapters.length - 1 ? `
                    <div class="absolute left-8 top-16 bottom-[-2rem] w-0.5 bg-slate-200 z-0"></div>
                ` : '';

                return `
                    <div class="relative">
                        ${lineHtml}
                        <div class="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm relative z-10">
                            <div class="flex justify-between items-start mb-6">
                                <div>
                                    <h3 class="text-xl font-bold text-slate-800">${chapter.title}</h3>
                                    ${progressHtml}
                                </div>
                                ${isComplete ? `
                                    <div class="text-green-500 bg-green-50 p-2 rounded-full border border-green-100 animate-stamp">
                                        <i data-lucide="award" class="w-6 h-6"></i>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="flex flex-wrap gap-3">
                                ${pillsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="space-y-8">
                    <button 
                        onclick="window.app.navigate('grade', ${gradeIdx})"
                        class="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium"
                    >
                        <i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Back to ${state.activeGrade.title}
                    </button>

                    <div class="pb-6 border-b-2 border-dashed border-slate-200">
                        <span class="font-handwritten text-2xl text-slate-500">${state.activeGrade.title}</span>
                        <h1 class="text-4xl font-bold text-slate-800 mt-1">${state.activeUnit.title}</h1>
                    </div>

                    <div class="space-y-8">
                        ${chaptersHtml}
                    </div>
                </div>
            `;
        }

        // 4. Lesson View: Shows Content
        function generateLessonHTML() {
            const isDone = state.completedLessons.includes(state.activeLesson.id);
            const gradeIdx = CURRICULUM.grades.findIndex(g => g.id === state.activeGrade.id);
            const unitIdx = state.activeGrade.units.findIndex(u => u.id === state.activeUnit.id);

            const actionAreaHtml = isDone ? `
                <div class="flex flex-col items-center animate-fade-in">
                    <div class="text-green-600 font-handwritten text-3xl mb-2 flex items-center gap-2">
                        <i data-lucide="check" class="w-7 h-7"></i> Lesson Completed!
                    </div>
                    <button 
                        onclick="window.app.navigate('unit', ${gradeIdx}, ${unitIdx})"
                        class="px-6 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
                    >
                        Return to Unit
                    </button>
                </div>
            ` : `
                <button 
                    onclick="window.app.markComplete('${state.activeLesson.id}')"
                    class="px-8 py-4 bg-slate-800 text-white rounded-full font-bold shadow-md hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                >
                    <i data-lucide="check-circle" class="w-5 h-5"></i> Mark as Complete
                </button>
            `;

            return `
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <button 
                            onclick="window.app.navigate('unit', ${gradeIdx}, ${unitIdx})"
                            class="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm"
                        >
                            <i data-lucide="arrow-left" class="w-4 h-4 mr-1"></i> Back to ${state.activeUnit.title}
                        </button>
                        <span class="font-handwritten text-lg text-slate-400">${state.activeChapter.title}</span>
                    </div>

                    <div class="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                        <!-- Sample Slide Lesson Area -->
                        <div class="p-6 sm:p-8 pb-0">
                            <div class="bg-[#FAF9F6] border-2 border-slate-200 rounded-2xl aspect-[16/9] sm:aspect-[4/3] flex flex-col relative shadow-inner overflow-hidden">
                                <div class="p-6 sm:p-8 flex-1 flex flex-col">
                                    <span class="text-blue-500 font-bold uppercase tracking-wider text-xs mb-2">Slide 1 of 3</span>
                                    <h2 class="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">${state.activeLesson.title}</h2>
                                    <div class="text-slate-600 text-base sm:text-lg leading-relaxed flex-1">
                                        <p class="mb-4">Welcome to this sample slide! Instead of a video, you'll flip through pages like this.</p>
                                        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 flex flex-col gap-1">
                                            <span class="font-bold">Note:</span> 
                                            <span>This is a mock slide that doesn't work yet, as requested!</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="border-t-2 border-slate-200 p-4 bg-white flex justify-between items-center">
                                    <button class="px-4 py-2 text-slate-400 font-medium cursor-not-allowed">&larr; Previous</button>
                                    <div class="flex gap-2">
                                        <div class="w-2 h-2 rounded-full bg-slate-800"></div>
                                        <div class="w-2 h-2 rounded-full bg-slate-300"></div>
                                        <div class="w-2 h-2 rounded-full bg-slate-300"></div>
                                    </div>
                                    <button class="px-4 py-2 text-slate-800 font-medium border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Next &rarr;</button>
                                </div>
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="p-8 notebook-divider min-h-[200px]">
                            <div class="bg-white p-2 mt-4">
                                <p class="text-slate-600 leading-relaxed mb-4">
                                    Take out your notebook and get ready to follow along with the slides above. 
                                </p>
                                <div class="pl-4 border-l-2 border-blue-300 my-8">
                                    <p class="font-handwritten text-2xl text-blue-800">
                                        Tip: Remember to always check your work!
                                    </p>
                                </div>
                            </div>

                            <div class="mt-12 pt-6 flex justify-center bg-white px-2">
                                ${actionAreaHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- BOOTSTRAP ---
        init();
