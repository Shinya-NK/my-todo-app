'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, LogOut, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Comment {
  id: number;
  user_id: number;
  user_name: string;
  text: string;
  timestamp: number;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  user_id: number;
  comments: Comment[];
}

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [todoId: number]: string }>({});
  const commentListRefs = useRef<{ [todoId: number]: HTMLDivElement | null }>({});

  // 新規登録フォームの状態
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const supabase = createClient();

  // ログイン状態をlocalStorageから復元
  useEffect(() => {
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
      fetchUsers().then(() => {
        const userId = parseInt(savedUserId);
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data);
            }
          });
      });
    }
  }, []);

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  // タスクとコメントを取得
  const fetchTodos = async () => {
    if (!currentUser) return;

    const { data: todosData, error: todosError } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('id');

    if (todosError) {
      console.error('Error fetching todos:', todosError);
      return;
    }

    // 各タスクのコメントを取得
    const todosWithComments = await Promise.all(
      (todosData || []).map(async (todo) => {
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('todo_id', todo.id)
          .order('timestamp');

        if (commentsError) {
          console.error('Error fetching comments:', commentsError);
        }

        return {
          ...todo,
          comments: commentsData || [],
        };
      })
    );

    setTodos(todosWithComments);
  };

  // ユーザー一覧を初期取得
  useEffect(() => {
    fetchUsers();
  }, []);

  // ログイン時にタスクを取得
  useEffect(() => {
    if (currentUser) {
      fetchTodos();
    } else {
      setTodos([]);
    }
  }, [currentUser]);

  // リアルタイム更新を設定
  useEffect(() => {
    if (!currentUser) return;

    // Todosのリアルタイム更新
    const todosSubscription = supabase
      .channel('todos-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          fetchTodos();
        }
      )
      .subscribe();

    // Commentsのリアルタイム更新
    const commentsSubscription = supabase
      .channel('comments-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        () => {
          fetchTodos();
        }
      )
      .subscribe();

    return () => {
      todosSubscription.unsubscribe();
      commentsSubscription.unsubscribe();
    };
  }, [currentUser]);

  // ログイン処理
  const handleLogin = () => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('currentUserId', user.id.toString());
      }
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    setCurrentUser(null);
    setInputValue('');
    localStorage.removeItem('currentUserId');
  };

  // 新規登録処理
  const handleRegister = async () => {
    if (registerName.trim() === '' || registerEmail.trim() === '') {
      alert('名前とメールアドレスを入力してください');
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          name: registerName.trim(),
          email: registerEmail.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      alert('ユーザーの登録に失敗しました');
      return;
    }

    setUsers([...users, data]);
    setCurrentUser(data);
    localStorage.setItem('currentUserId', data.id.toString());
    setRegisterName('');
    setRegisterEmail('');
    setShowRegisterForm(false);
  };

  // タスクを追加
  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || !currentUser) return;

    const { error } = await supabase
      .from('todos')
      .insert([
        {
          text: inputValue.trim(),
          completed: false,
          user_id: currentUser.id,
        },
      ]);

    if (error) {
      console.error('Error adding todo:', error);
      return;
    }

    setInputValue('');
    fetchTodos();
  };

  // タスクの完了状態をトグル
  const handleToggleTodo = async (id: number) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const { error } = await supabase
      .from('todos')
      .update({ completed: !todo.completed })
      .eq('id', id);

    if (error) {
      console.error('Error updating todo:', error);
      return;
    }

    fetchTodos();
  };

  // タスクを削除
  const handleDeleteTodo = async (id: number) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting todo:', error);
      return;
    }

    fetchTodos();
  };

  // コメントを追加
  const handleAddComment = async (todoId: number) => {
    const commentText = commentInputs[todoId];
    if (!commentText?.trim() || !currentUser) return;

    const { error } = await supabase
      .from('comments')
      .insert([
        {
          todo_id: todoId,
          user_id: currentUser.id,
          user_name: currentUser.name,
          text: commentText.trim(),
          timestamp: Date.now(),
        },
      ]);

    if (error) {
      console.error('Error adding comment:', error);
      return;
    }

    setCommentInputs({ ...commentInputs, [todoId]: '' });
    fetchTodos();

    // コメント追加後、自動的に一番下までスクロール
    setTimeout(() => {
      const commentListElement = commentListRefs.current[todoId];
      if (commentListElement) {
        commentListElement.scrollTop = commentListElement.scrollHeight;
      }
    }, 100);
  };

  // コメントを削除
  const handleDeleteComment = async (todoId: number, commentId: number) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return;
    }

    fetchTodos();
  };

  // Enterキーで追加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleAddTodo();
    }
  };

  // ドラッグ開始
  const handleDragStart = (todo: Todo) => {
    setDraggedTodo(todo);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedTodo(null);
  };

  // ドロップ処理
  const handleDrop = async (completed: boolean) => {
    if (draggedTodo && draggedTodo.completed !== completed) {
      const { error } = await supabase
        .from('todos')
        .update({ completed })
        .eq('id', draggedTodo.id);

      if (error) {
        console.error('Error updating todo:', error);
        return;
      }

      fetchTodos();
    }
    setDraggedTodo(null);
  };

  // ドラッグオーバー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // 現在のユーザーのタスクでフィルタリング
  const userTodos = currentUser ? todos : [];
  const incompleteTodos = userTodos.filter(todo => !todo.completed);
  const completedTodos = userTodos.filter(todo => todo.completed);

  // ログイン前の画面
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-3">
              カンバンボード
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              ログインしてタスクを管理
            </p>
          </div>

          {!showRegisterForm ? (
            // ログイン画面
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">ログイン</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ユーザーを選択
                  </label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">ユーザーを選択してください</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={!selectedUserId}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  ログイン
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">または</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="w-full px-6 py-3 border-2 border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <UserPlus size={20} />
                  新規登録
                </button>
              </div>
            </div>
          ) : (
            // 新規登録画面
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">新規登録</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    名前
                  </label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="田中太郎"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="tanaka@example.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <button
                  onClick={handleRegister}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  登録してログイン
                </button>

                <button
                  onClick={() => {
                    setShowRegisterForm(false);
                    setRegisterName('');
                    setRegisterEmail('');
                  }}
                  className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold rounded-lg transition-all duration-200"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ログイン後の画面
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-3">
              カンバンボード
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              ようこそ、<span className="font-semibold text-blue-600 dark:text-blue-400">{currentUser.name}</span>さん
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <LogOut size={20} />
            ログアウト
          </button>
        </div>

        {/* 入力エリア */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="新しいタスクを入力..."
                className="flex-1 px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
              <button
                onClick={handleAddTodo}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <Plus size={20} />
                追加
              </button>
            </div>
          </div>
        </div>

        {/* カンバンボード */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 未完了カラム */}
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 transition-all"
            onDrop={() => handleDrop(false)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                未完了
              </h2>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
                {incompleteTodos.length}
              </span>
            </div>

            {incompleteTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-lg">タスクがありません</p>
                <p className="text-sm mt-2">新しいタスクを追加してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incompleteTodos.map((todo) => (
                  <div
                    key={todo.id}
                    draggable
                    onDragStart={() => handleDragStart(todo)}
                    onDragEnd={handleDragEnd}
                    className={`group bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 cursor-move hover:shadow-lg transition-all duration-200 ${
                      draggedTodo?.id === todo.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <p className="flex-1 text-gray-800 dark:text-white font-medium">
                        {todo.text}
                      </p>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                        aria-label="タスクを削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* コメントセクション */}
                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-gray-600 cursor-default" onClick={(e) => e.stopPropagation()}>
                      {/* コメント一覧 */}
                      <div
                        ref={(el) => { commentListRefs.current[todo.id] = el; }}
                        className="mb-3 space-y-2 max-h-40 overflow-y-auto"
                      >
                        {todo.comments.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">コメントはありません</p>
                        ) : (
                          todo.comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-md p-2 group/comment hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  {comment.user_name}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(comment.timestamp).toLocaleString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {currentUser && comment.user_id === currentUser.id && (
                                  <button
                                    onClick={() => handleDeleteComment(todo.id, comment.id)}
                                    className="ml-auto opacity-0 group-hover/comment:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                    aria-label="コメントを削除"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* コメント入力 */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentInputs[todo.id] || ''}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [todo.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleAddComment(todo.id);
                            }
                          }}
                          placeholder="コメントを追加..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          onClick={() => handleAddComment(todo.id)}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors duration-200"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 完了済みカラム */}
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 transition-all"
            onDrop={() => handleDrop(true)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                完了済み
              </h2>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
                {completedTodos.length}
              </span>
            </div>

            {completedTodos.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-lg">完了したタスクがありません</p>
                <p className="text-sm mt-2">タスクを完了してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    draggable
                    onDragStart={() => handleDragStart(todo)}
                    onDragEnd={handleDragEnd}
                    className={`group bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-600 border-2 border-green-200 dark:border-green-800 rounded-lg p-4 cursor-move hover:shadow-lg transition-all duration-200 ${
                      draggedTodo?.id === todo.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-2 focus:ring-green-500 cursor-pointer"
                      />
                      <p className="flex-1 text-gray-500 dark:text-gray-400 line-through">
                        {todo.text}
                      </p>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                        aria-label="タスクを削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* コメントセクション */}
                    <div className="mt-4 pt-4 border-t border-green-200 dark:border-gray-600 cursor-default" onClick={(e) => e.stopPropagation()}>
                      {/* コメント一覧 */}
                      <div
                        ref={(el) => { commentListRefs.current[todo.id] = el; }}
                        className="mb-3 space-y-2 max-h-40 overflow-y-auto"
                      >
                        {todo.comments.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">コメントはありません</p>
                        ) : (
                          todo.comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-md p-2 group/comment hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                  {comment.user_name}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(comment.timestamp).toLocaleString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {currentUser && comment.user_id === currentUser.id && (
                                  <button
                                    onClick={() => handleDeleteComment(todo.id, comment.id)}
                                    className="ml-auto opacity-0 group-hover/comment:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                    aria-label="コメントを削除"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* コメント入力 */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentInputs[todo.id] || ''}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [todo.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleAddComment(todo.id);
                            }
                          }}
                          placeholder="コメントを追加..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          onClick={() => handleAddComment(todo.id)}
                          className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors duration-200"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* タスクサマリー */}
        {userTodos.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex gap-6 bg-white dark:bg-gray-800 px-8 py-4 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{incompleteTodos.length}</span> 未完了
              </div>
              <div className="w-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-green-600 dark:text-green-400">{completedTodos.length}</span> 完了
              </div>
              <div className="w-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{userTodos.length}</span> 合計
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
