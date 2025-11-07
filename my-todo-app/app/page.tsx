'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  user_id: number;
}

interface Comment {
  id: number;
  todo_id: number;
  user_id: number;
  user_name: string;
  content: string;
  timestamp: number;
}

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [commentInputs, setCommentInputs] = useState<{ [todoId: number]: string }>({});
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // ユーザーデータの読み込み
  useEffect(() => {
    loadUsers();
  }, []);

  // 現在のユーザーのデータを読み込み
  useEffect(() => {
    if (currentUser) {
      loadTodos();
      loadComments();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      if (data) {
        setUsers(data);
        if (data.length > 0) {
          setSelectedUserId(data[0].id);
        }
      }
    } catch (error) {
      console.error('ユーザー読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodos = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

      if (error) throw error;
      if (data) setTodos(data);
    } catch (error) {
      console.error('Todo読み込みエラー:', error);
    }
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('timestamp', { ascending: true });

      if (error) throw error;
      if (data) setComments(data);
    } catch (error) {
      console.error('コメント読み込みエラー:', error);
    }
  };

  // 現在のユーザーのタスクのみフィルタリング
  const userTodos = currentUser
    ? todos.filter(todo => todo.user_id === currentUser.id)
    : [];

  // ログイン処理
  const handleLogin = () => {
    const user = users.find(u => u.id === selectedUserId);
    if (user) {
      setCurrentUser(user);
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    setCurrentUser(null);
    setTodos([]);
    setComments([]);
  };

  // 新規登録処理
  const handleRegister = async () => {
    if (newUserName.trim() === '' || newUserEmail.trim() === '') {
      alert('名前とメールアドレスを入力してください');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            name: newUserName.trim(),
            email: newUserEmail.trim(),
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setUsers([...users, data]);
        setCurrentUser(data);
        setNewUserName('');
        setNewUserEmail('');
        setShowRegisterForm(false);
      }
    } catch (error: any) {
      console.error('登録エラー:', error);
      if (error.code === '23505') {
        alert('このメールアドレスは既に登録されています');
      } else {
        alert('登録に失敗しました');
      }
    }
  };

  // タスクを追加
  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([
          {
            text: inputValue.trim(),
            completed: false,
            user_id: currentUser.id,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTodos([...todos, data]);
        setInputValue('');
      }
    } catch (error) {
      console.error('Todo追加エラー:', error);
      alert('タスクの追加に失敗しました');
    }
  };

  // タスクの完了状態をトグル
  const handleToggleTodo = async (id: number) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', id);

      if (error) throw error;

      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ));
    } catch (error) {
      console.error('Todo更新エラー:', error);
      alert('タスクの更新に失敗しました');
    }
  };

  // タスクを削除
  const handleDeleteTodo = async (id: number) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTodos(todos.filter(todo => todo.id !== id));
      setComments(comments.filter(comment => comment.todo_id !== id));
    } catch (error) {
      console.error('Todo削除エラー:', error);
      alert('タスクの削除に失敗しました');
    }
  };

  // コメントを追加
  const handleAddComment = async (todoId: number) => {
    if (!currentUser) return;

    const commentText = commentInputs[todoId]?.trim();
    if (!commentText) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            todo_id: todoId,
            user_id: currentUser.id,
            user_name: currentUser.name,
            content: commentText,
            timestamp: Date.now(),
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setComments([...comments, data]);
        setCommentInputs({ ...commentInputs, [todoId]: '' });
      }
    } catch (error) {
      console.error('コメント追加エラー:', error);
      alert('コメントの追加に失敗しました');
    }
  };

  // コメント入力値の変更
  const handleCommentInputChange = (todoId: number, value: string) => {
    setCommentInputs({ ...commentInputs, [todoId]: value });
  };

  // 特定のタスクのコメントを取得
  const getTaskComments = (todoId: number): Comment[] => {
    return comments
      .filter(comment => comment.todo_id === todoId)
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  // Enterキーで追加（IME変換中は除く）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleAddTodo();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            読み込み中...
          </div>
        </div>
      </main>
    );
  }

  // ログイン画面
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
              Todo管理アプリ
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              ログインしてください
            </p>
          </div>

          {!showRegisterForm ? (
            // ログインフォーム
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
                ログイン
              </h2>

              <div className="mb-6">
                <label className="block text-gray-700 dark:text-gray-300 mb-2 font-semibold">
                  ユーザーを選択
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleLogin}
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200 mb-4"
              >
                ログイン
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                >
                  新規登録はこちら
                </button>
              </div>
            </div>
          ) : (
            // 新規登録フォーム
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
                新規登録
              </h2>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2 font-semibold">
                  名前
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="例: 山田太郎"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 dark:text-gray-300 mb-2 font-semibold">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                onClick={handleRegister}
                className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors duration-200 mb-4"
              >
                登録
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegisterForm(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  ログイン画面に戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ログイン後のTodoアプリ画面
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                ようこそ、{currentUser.name}さん
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {currentUser.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* タイトル */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            Todo管理
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            シンプルなタスク管理
          </p>
        </div>

        {/* 入力エリア */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="新しいタスクを入力..."
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleAddTodo}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              追加
            </button>
          </div>
        </div>

        {/* タスク一覧 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            タスク一覧
          </h2>

          {userTodos.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>タスクがありません</p>
              <p className="text-sm mt-2">上の入力欄からタスクを追加してください</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {userTodos.map((todo) => (
                <li
                  key={todo.id}
                  className={`rounded-lg p-4 border transition-all duration-200 ${
                    todo.completed
                      ? 'bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* タスク本体 */}
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                    <p
                      className={`flex-1 transition-all duration-200 ${
                        todo.completed
                          ? 'text-gray-500 dark:text-gray-400 line-through'
                          : 'text-gray-800 dark:text-white'
                      }`}
                    >
                      {todo.text}
                    </p>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-2 transition-colors duration-200"
                      aria-label="削除"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* コメントセクション */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
                    {/* コメント一覧 */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        コメント
                      </h4>
                      {getTaskComments(todo.id).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          コメントはありません
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {getTaskComments(todo.id).map((comment) => (
                            <div
                              key={comment.id}
                              className="bg-gray-100 dark:bg-gray-600/30 rounded p-2"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  {comment.user_name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(comment.timestamp).toLocaleString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* コメント入力欄 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentInputs[todo.id] || ''}
                        onChange={(e) => handleCommentInputChange(todo.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            handleAddComment(todo.id);
                          }
                        }}
                        placeholder="コメントを入力..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <button
                        onClick={() => handleAddComment(todo.id)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors duration-200"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* タスク数表示 */}
          {userTodos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                合計 <span className="font-semibold text-blue-600 dark:text-blue-400">{userTodos.length}</span> 件のタスク
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
