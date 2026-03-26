import { useState, useEffect } from 'preact/hooks';
import { PayStatusEnum } from 'shared-types';
import { formatAmount } from 'shared-utils';

// 【前端红线】H5 严格遵循状态机渲染，不做复杂分支
type H5State = PayStatusEnum.UNPAID | PayStatusEnum.PAYING | PayStatusEnum.PAID | PayStatusEnum.EXPIRED;

export function App() {
  const [status, setStatus] = useState<H5State>(PayStatusEnum.UNPAID);
  const [amount, setAmount] = useState<string>('0.00');
  
  // 模拟：从 URL 获取 qrToken，向后端获取支付信息
  useEffect(() => {
    // 【前端红线】绝不传递前端指定的金额给后端，由后端下发
    setAmount('1580.00'); 
  }, []);

  const handlePay = async () => {
    setStatus(PayStatusEnum.PAYING);
    try {
      // 模拟调用 /api/payment/initiate/:qrToken 以通过 Redis 并发锁获取拉卡拉参数
      await new Promise(res => setTimeout(res, 1000));
      setStatus(PayStatusEnum.PAID);
    } catch {
      setStatus(PayStatusEnum.UNPAID);
    }
  };

  if (status === PayStatusEnum.PAID) {
    return (
      <div class="pay-container">
        <div class="status-paid">✅ 支付成功</div>
        <p>感谢您的付款</p>
      </div>
    );
  }

  if (status === PayStatusEnum.EXPIRED) {
    return (
      <div class="pay-container">
        <h2 style={{ color: 'red' }}>二维码已过期</h2>
        <p>请联系业务员重新生成</p>
      </div>
    );
  }

  return (
    <div class="pay-container">
      <h2>向经销商付款</h2>
      <div class="amount">¥ {formatAmount(amount)}</div>
      
      <button 
        class="btn-pay" 
        onClick={handlePay}
        disabled={status === PayStatusEnum.PAYING}
      >
        {status === PayStatusEnum.PAYING ? '支付中...' : '立即支付'}
      </button>
      <p style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
        【安全红线】：金额由服务端权威锁定计算
      </p>
    </div>
  );
}
