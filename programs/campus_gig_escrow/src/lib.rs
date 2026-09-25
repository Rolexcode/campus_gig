use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("5xcjvcVCAbdrJtzRZv8UkeGhTPTFGAiTTeLLauKam7d8");

const CONFIG_SEED: &[u8] = b"config";
const ESCROW_SEED: &[u8] = b"escrow";
const VAULT_SEED: &[u8] = b"vault";
const BPS_DENOMINATOR: u128 = 10_000;
const MAX_PROTOCOL_FEE_BPS: u16 = 2_500;
const MAX_CONTRACT_DURATION_SECONDS: i64 = 365 * 24 * 60 * 60;

#[program]
pub mod campus_gig_escrow {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        pause_authority: Pubkey,
        dispute_authority: Pubkey,
        fee_recipient: Pubkey,
        allowed_mint: Pubkey,
        max_fee_bps: u16,
    ) -> Result<()> {
        validate_non_default_key(pause_authority)?;
        validate_non_default_key(dispute_authority)?;
        validate_non_default_key(fee_recipient)?;
        validate_non_default_key(allowed_mint)?;
        require!(max_fee_bps <= MAX_PROTOCOL_FEE_BPS, EscrowError::FeeTooHigh);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.pending_admin = Pubkey::default();
        config.pause_authority = pause_authority;
        config.dispute_authority = dispute_authority;
        config.fee_recipient = fee_recipient;
        config.allowed_mint = allowed_mint;
        config.max_fee_bps = max_fee_bps;
        config.paused = false;
        config.bump = ctx.bumps.config;
        config.version = 1;

        emit!(ConfigInitialized {
            admin: config.admin,
            pause_authority,
            dispute_authority,
            fee_recipient,
            allowed_mint,
            max_fee_bps,
        });
        Ok(())
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(PauseChanged {
            authority: ctx.accounts.pause_authority.key(),
            paused,
        });
        Ok(())
    }

    pub fn propose_admin(ctx: Context<AdminConfig>, new_admin: Pubkey) -> Result<()> {
        validate_non_default_key(new_admin)?;
        require_keys_neq!(
            new_admin,
            ctx.accounts.config.admin,
            EscrowError::AuthorityUnchanged
        );
        ctx.accounts.config.pending_admin = new_admin;
        emit!(AdminProposed {
            current_admin: ctx.accounts.admin.key(),
            pending_admin: new_admin,
        });
        Ok(())
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        let previous_admin = ctx.accounts.config.admin;
        let next_admin = ctx.accounts.pending_admin.key();
        ctx.accounts.config.admin = next_admin;
        ctx.accounts.config.pending_admin = Pubkey::default();
        emit!(AdminAccepted {
            previous_admin,
            new_admin: next_admin,
        });
        Ok(())
    }

    pub fn update_operational_authorities(
        ctx: Context<AdminConfig>,
        pause_authority: Pubkey,
        dispute_authority: Pubkey,
        fee_recipient: Pubkey,
        max_fee_bps: u16,
    ) -> Result<()> {
        validate_non_default_key(pause_authority)?;
        validate_non_default_key(dispute_authority)?;
        validate_non_default_key(fee_recipient)?;
        require!(max_fee_bps <= MAX_PROTOCOL_FEE_BPS, EscrowError::FeeTooHigh);
        let config = &mut ctx.accounts.config;
        config.pause_authority = pause_authority;
        config.dispute_authority = dispute_authority;
        config.fee_recipient = fee_recipient;
        config.max_fee_bps = max_fee_bps;
        emit!(OperationalAuthoritiesUpdated {
            admin: ctx.accounts.admin.key(),
            pause_authority,
            dispute_authority,
            fee_recipient,
            max_fee_bps,
        });
        Ok(())
    }

    pub fn fund_escrow(
        ctx: Context<FundEscrow>,
        gig_id_hash: [u8; 32],
        agreement_hash: [u8; 32],
        amount: u64,
        fee_bps: u16,
        deadline: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.config.paused, EscrowError::ProtocolPaused);
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(
            fee_bps <= ctx.accounts.config.max_fee_bps,
            EscrowError::FeeTooHigh
        );
        require!(
            deadline > now
                && deadline
                    <= now
                        .checked_add(MAX_CONTRACT_DURATION_SECONDS)
                        .ok_or(EscrowError::MathOverflow)?,
            EscrowError::InvalidDeadline
        );
        require!(
            gig_id_hash != [0; 32] && agreement_hash != [0; 32],
            EscrowError::InvalidHash
        );
        require_keys_neq!(
            ctx.accounts.client.key(),
            ctx.accounts.worker.key(),
            EscrowError::SameParticipant
        );
        require_keys_neq!(
            ctx.accounts.worker.key(),
            ctx.accounts.config.fee_recipient,
            EscrowError::InvalidFeeRecipient
        );

        let escrow = &mut ctx.accounts.escrow;
        escrow.gig_id_hash = gig_id_hash;
        escrow.agreement_hash = agreement_hash;
        escrow.config = ctx.accounts.config.key();
        escrow.client = ctx.accounts.client.key();
        escrow.worker = ctx.accounts.worker.key();
        escrow.rent_payer = ctx.accounts.payer.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.vault = ctx.accounts.vault.key();
        escrow.amount = amount;
        escrow.fee_bps = fee_bps;
        escrow.deadline = deadline;
        escrow.funded_at = now;
        escrow.settled_at = 0;
        escrow.worker_amount = 0;
        escrow.client_refund_amount = 0;
        escrow.platform_fee_amount = 0;
        escrow.disputed_by = Pubkey::default();
        escrow.status = EscrowStatus::Funded;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;
        escrow.version = 1;

        let transfer_accounts = TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.client_source.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.client.to_account_info(),
        };
        token_interface::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.key(), transfer_accounts),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(EscrowFunded {
            escrow: escrow.key(),
            gig_id_hash,
            agreement_hash,
            client: escrow.client,
            worker: escrow.worker,
            mint: escrow.mint,
            amount,
            fee_bps,
            deadline,
        });
        Ok(())
    }

    pub fn release(ctx: Context<ReleaseEscrow>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidEscrowState
        );
        let amount = ctx.accounts.escrow.amount;
        let split = settlement_split(amount, amount, ctx.accounts.escrow.fee_bps)?;
        settle_escrow(
            &mut ctx.accounts.escrow,
            EscrowStatus::Released,
            split,
            Clock::get()?.unix_timestamp,
        );
        transfer_settlement(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.vault,
            &ctx.accounts.worker_destination,
            &ctx.accounts.client_destination,
            &ctx.accounts.platform_destination,
            &ctx.accounts.escrow,
            &ctx.accounts.rent_destination.to_account_info(),
            split,
        )?;
        emit_settlement(&ctx.accounts.escrow, EscrowStatus::Released, split);
        Ok(())
    }

    pub fn open_dispute(ctx: Context<OpenDispute>, reason_hash: [u8; 32]) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidEscrowState
        );
        require!(reason_hash != [0; 32], EscrowError::InvalidHash);
        let authority = ctx.accounts.authority.key();
        require!(
            authority == ctx.accounts.escrow.client || authority == ctx.accounts.escrow.worker,
            EscrowError::Unauthorized
        );
        ctx.accounts.escrow.status = EscrowStatus::Disputed;
        ctx.accounts.escrow.disputed_by = authority;
        emit!(DisputeOpened {
            escrow: ctx.accounts.escrow.key(),
            opened_by: authority,
            reason_hash,
        });
        Ok(())
    }

    pub fn mutual_refund(ctx: Context<MutualRefund>) -> Result<()> {
        require!(
            matches!(
                ctx.accounts.escrow.status,
                EscrowStatus::Funded | EscrowStatus::Disputed
            ),
            EscrowError::InvalidEscrowState
        );
        let split = settlement_split(ctx.accounts.escrow.amount, 0, ctx.accounts.escrow.fee_bps)?;
        settle_escrow(
            &mut ctx.accounts.escrow,
            EscrowStatus::Refunded,
            split,
            Clock::get()?.unix_timestamp,
        );
        transfer_settlement(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.vault,
            &ctx.accounts.worker_destination,
            &ctx.accounts.client_destination,
            &ctx.accounts.platform_destination,
            &ctx.accounts.escrow,
            &ctx.accounts.rent_destination.to_account_info(),
            split,
        )?;
        emit_settlement(&ctx.accounts.escrow, EscrowStatus::Refunded, split);
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, worker_gross_amount: u64) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidEscrowState
        );
        let split = settlement_split(
            ctx.accounts.escrow.amount,
            worker_gross_amount,
            ctx.accounts.escrow.fee_bps,
        )?;
        settle_escrow(
            &mut ctx.accounts.escrow,
            EscrowStatus::Resolved,
            split,
            Clock::get()?.unix_timestamp,
        );
        transfer_settlement(
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            &ctx.accounts.vault,
            &ctx.accounts.worker_destination,
            &ctx.accounts.client_destination,
            &ctx.accounts.platform_destination,
            &ctx.accounts.escrow,
            &ctx.accounts.rent_destination.to_account_info(),
            split,
        )?;
        emit_settlement(&ctx.accounts.escrow, EscrowStatus::Resolved, split);
        Ok(())
    }

    pub fn resume_dispute(ctx: Context<ResumeDispute>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidEscrowState
        );
        ctx.accounts.escrow.status = EscrowStatus::Funded;
        ctx.accounts.escrow.disputed_by = Pubkey::default();
        emit!(DisputeResumed {
            escrow: ctx.accounts.escrow.key(),
            resumed_by: ctx.accounts.dispute_authority.key(),
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
            @ EscrowError::WrongProgramData
    )]
    pub program: Program<'info, crate::program::CampusGigEscrow>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key())
            @ EscrowError::Unauthorized
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    pub pause_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pause_authority == pause_authority.key() @ EscrowError::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,
}

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.admin == admin.key() @ EscrowError::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub pending_admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pending_admin != Pubkey::default() @ EscrowError::NoPendingAdmin,
        constraint = config.pending_admin == pending_admin.key() @ EscrowError::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,
}

#[derive(Accounts)]
#[instruction(gig_id_hash: [u8; 32])]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
    /// CHECK: The worker is stored as an immutable settlement destination owner.
    pub worker: UncheckedAccount<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.allowed_mint == mint.key() @ EscrowError::WrongMint
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = payer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, gig_id_hash.as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        init,
        payer = payer,
        seeds = [VAULT_SEED, escrow.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
        token::token_program = token_program
    )]
    pub client_source: InterfaceAccount<'info, TokenAccount>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(address = escrow.client @ EscrowError::Unauthorized)]
    pub client: Signer<'info>,
    /// CHECK: Receives only reclaimed rent after the empty token vault closes.
    #[account(mut, address = escrow.rent_payer @ EscrowError::WrongRecipient)]
    pub rent_destination: UncheckedAccount<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        address = escrow.config @ EscrowError::WrongConfig
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.gig_id_hash.as_ref()],
        bump = escrow.bump,
        has_one = mint @ EscrowError::WrongMint,
        has_one = vault @ EscrowError::WrongVault
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        seeds = [VAULT_SEED, escrow.key().as_ref()],
        bump = escrow.vault_bump,
        token::mint = mint,
        token::authority = escrow,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = worker_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = worker_destination.owner == escrow.worker @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub worker_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = client_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = client_destination.owner == escrow.client @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub client_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = platform_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = platform_destination.owner == config.fee_recipient @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub platform_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(mint::token_program = token_program, address = escrow.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.gig_id_hash.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct MutualRefund<'info> {
    #[account(address = escrow.client @ EscrowError::Unauthorized)]
    pub client: Signer<'info>,
    #[account(address = escrow.worker @ EscrowError::Unauthorized)]
    pub worker: Signer<'info>,
    /// CHECK: Receives only reclaimed rent after the empty token vault closes.
    #[account(mut, address = escrow.rent_payer @ EscrowError::WrongRecipient)]
    pub rent_destination: UncheckedAccount<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        address = escrow.config @ EscrowError::WrongConfig
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.gig_id_hash.as_ref()],
        bump = escrow.bump,
        has_one = mint @ EscrowError::WrongMint,
        has_one = vault @ EscrowError::WrongVault
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        seeds = [VAULT_SEED, escrow.key().as_ref()],
        bump = escrow.vault_bump,
        token::mint = mint,
        token::authority = escrow,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = worker_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = worker_destination.owner == escrow.worker @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub worker_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = client_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = client_destination.owner == escrow.client @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub client_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = platform_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = platform_destination.owner == config.fee_recipient @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub platform_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(mint::token_program = token_program, address = escrow.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(address = config.dispute_authority @ EscrowError::Unauthorized)]
    pub dispute_authority: Signer<'info>,
    /// CHECK: Receives only reclaimed rent after the empty token vault closes.
    #[account(mut, address = escrow.rent_payer @ EscrowError::WrongRecipient)]
    pub rent_destination: UncheckedAccount<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        address = escrow.config @ EscrowError::WrongConfig
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.gig_id_hash.as_ref()],
        bump = escrow.bump,
        has_one = mint @ EscrowError::WrongMint,
        has_one = vault @ EscrowError::WrongVault
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        seeds = [VAULT_SEED, escrow.key().as_ref()],
        bump = escrow.vault_bump,
        token::mint = mint,
        token::authority = escrow,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = worker_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = worker_destination.owner == escrow.worker @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub worker_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = client_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = client_destination.owner == escrow.client @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub client_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = platform_destination.mint == escrow.mint @ EscrowError::WrongMint,
        constraint = platform_destination.owner == config.fee_recipient @ EscrowError::WrongRecipient,
        token::token_program = token_program
    )]
    pub platform_destination: InterfaceAccount<'info, TokenAccount>,
    #[account(mint::token_program = token_program, address = escrow.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ResumeDispute<'info> {
    #[account(address = config.dispute_authority @ EscrowError::Unauthorized)]
    pub dispute_authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        address = escrow.config @ EscrowError::WrongConfig
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.gig_id_hash.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
    pub pause_authority: Pubkey,
    pub dispute_authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub allowed_mint: Pubkey,
    pub max_fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
    pub version: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub gig_id_hash: [u8; 32],
    pub agreement_hash: [u8; 32],
    pub config: Pubkey,
    pub client: Pubkey,
    pub worker: Pubkey,
    pub rent_payer: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub fee_bps: u16,
    pub deadline: i64,
    pub funded_at: i64,
    pub settled_at: i64,
    pub worker_amount: u64,
    pub client_refund_amount: u64,
    pub platform_fee_amount: u64,
    pub disputed_by: Pubkey,
    pub status: EscrowStatus,
    pub bump: u8,
    pub vault_bump: u8,
    pub version: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Funded,
    Disputed,
    Released,
    Refunded,
    Resolved,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SettlementSplit {
    pub worker_amount: u64,
    pub client_refund_amount: u64,
    pub platform_fee_amount: u64,
}

fn settlement_split(
    deposited_amount: u64,
    worker_gross_amount: u64,
    fee_bps: u16,
) -> Result<SettlementSplit> {
    require!(deposited_amount > 0, EscrowError::InvalidAmount);
    require!(
        worker_gross_amount <= deposited_amount,
        EscrowError::InvalidResolutionSplit
    );
    require!(fee_bps <= MAX_PROTOCOL_FEE_BPS, EscrowError::FeeTooHigh);
    let platform_fee_u128 = (worker_gross_amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(EscrowError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(EscrowError::MathOverflow)?;
    let platform_fee_amount =
        u64::try_from(platform_fee_u128).map_err(|_| error!(EscrowError::MathOverflow))?;
    let worker_amount = worker_gross_amount
        .checked_sub(platform_fee_amount)
        .ok_or(EscrowError::MathOverflow)?;
    let client_refund_amount = deposited_amount
        .checked_sub(worker_gross_amount)
        .ok_or(EscrowError::MathOverflow)?;
    let conserved = worker_amount
        .checked_add(client_refund_amount)
        .and_then(|value| value.checked_add(platform_fee_amount))
        .ok_or(EscrowError::MathOverflow)?;
    require_eq!(
        conserved,
        deposited_amount,
        EscrowError::ConservationViolation
    );
    Ok(SettlementSplit {
        worker_amount,
        client_refund_amount,
        platform_fee_amount,
    })
}

fn settle_escrow(
    escrow: &mut Account<Escrow>,
    status: EscrowStatus,
    split: SettlementSplit,
    settled_at: i64,
) {
    escrow.status = status;
    escrow.settled_at = settled_at;
    escrow.worker_amount = split.worker_amount;
    escrow.client_refund_amount = split.client_refund_amount;
    escrow.platform_fee_amount = split.platform_fee_amount;
}

#[allow(clippy::too_many_arguments)]
fn transfer_settlement<'info>(
    token_program: &Interface<'info, TokenInterface>,
    mint: &InterfaceAccount<'info, Mint>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    worker_destination: &InterfaceAccount<'info, TokenAccount>,
    client_destination: &InterfaceAccount<'info, TokenAccount>,
    platform_destination: &InterfaceAccount<'info, TokenAccount>,
    escrow: &Account<'info, Escrow>,
    rent_destination: &AccountInfo<'info>,
    split: SettlementSplit,
) -> Result<()> {
    let gig_id_hash = escrow.gig_id_hash;
    let bump = [escrow.bump];
    let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, gig_id_hash.as_ref(), &bump];
    let signer_seeds: &[&[&[u8]]] = &[escrow_seeds];

    transfer_from_vault(
        token_program,
        mint,
        vault,
        worker_destination,
        escrow,
        split.worker_amount,
        signer_seeds,
    )?;
    transfer_from_vault(
        token_program,
        mint,
        vault,
        client_destination,
        escrow,
        split.client_refund_amount,
        signer_seeds,
    )?;
    transfer_from_vault(
        token_program,
        mint,
        vault,
        platform_destination,
        escrow,
        split.platform_fee_amount,
        signer_seeds,
    )?;
    token_interface::close_account(CpiContext::new_with_signer(
        token_program.key(),
        CloseAccount {
            account: vault.to_account_info(),
            destination: rent_destination.clone(),
            authority: escrow.to_account_info(),
        },
        signer_seeds,
    ))?;
    Ok(())
}

fn transfer_from_vault<'info>(
    token_program: &Interface<'info, TokenInterface>,
    mint: &InterfaceAccount<'info, Mint>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    destination: &InterfaceAccount<'info, TokenAccount>,
    escrow: &Account<'info, Escrow>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                mint: mint.to_account_info(),
                from: vault.to_account_info(),
                to: destination.to_account_info(),
                authority: escrow.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        mint.decimals,
    )
}

fn emit_settlement(escrow: &Account<Escrow>, status: EscrowStatus, split: SettlementSplit) {
    emit!(EscrowSettled {
        escrow: escrow.key(),
        status,
        worker_amount: split.worker_amount,
        client_refund_amount: split.client_refund_amount,
        platform_fee_amount: split.platform_fee_amount,
    });
}

fn validate_non_default_key(key: Pubkey) -> Result<()> {
    require_keys_neq!(key, Pubkey::default(), EscrowError::InvalidAuthority);
    Ok(())
}

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub pause_authority: Pubkey,
    pub dispute_authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub allowed_mint: Pubkey,
    pub max_fee_bps: u16,
}

#[event]
pub struct PauseChanged {
    pub authority: Pubkey,
    pub paused: bool,
}

#[event]
pub struct AdminProposed {
    pub current_admin: Pubkey,
    pub pending_admin: Pubkey,
}

#[event]
pub struct AdminAccepted {
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[event]
pub struct OperationalAuthoritiesUpdated {
    pub admin: Pubkey,
    pub pause_authority: Pubkey,
    pub dispute_authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub max_fee_bps: u16,
}

#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub gig_id_hash: [u8; 32],
    pub agreement_hash: [u8; 32],
    pub client: Pubkey,
    pub worker: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub fee_bps: u16,
    pub deadline: i64,
}

#[event]
pub struct DisputeOpened {
    pub escrow: Pubkey,
    pub opened_by: Pubkey,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct DisputeResumed {
    pub escrow: Pubkey,
    pub resumed_by: Pubkey,
}

#[event]
pub struct EscrowSettled {
    pub escrow: Pubkey,
    pub status: EscrowStatus,
    pub worker_amount: u64,
    pub client_refund_amount: u64,
    pub platform_fee_amount: u64,
}

#[error_code]
pub enum EscrowError {
    #[msg("The protocol is paused for new escrow funding.")]
    ProtocolPaused,
    #[msg("The signer is not authorized for this operation.")]
    Unauthorized,
    #[msg("The amount must be greater than zero.")]
    InvalidAmount,
    #[msg("The platform fee exceeds the configured safety limit.")]
    FeeTooHigh,
    #[msg("The contract deadline is outside the allowed range.")]
    InvalidDeadline,
    #[msg("The gig or agreement hash is invalid.")]
    InvalidHash,
    #[msg("The client and worker must be different accounts.")]
    SameParticipant,
    #[msg("The fee recipient cannot also be the worker.")]
    InvalidFeeRecipient,
    #[msg("This escrow is not in the required state.")]
    InvalidEscrowState,
    #[msg("The resolution split exceeds the escrow deposit.")]
    InvalidResolutionSplit,
    #[msg("Checked arithmetic failed.")]
    MathOverflow,
    #[msg("Settlement would violate value conservation.")]
    ConservationViolation,
    #[msg("The supplied mint does not match the escrow mint.")]
    WrongMint,
    #[msg("The supplied vault does not match the escrow vault.")]
    WrongVault,
    #[msg("The supplied config does not match the escrow config.")]
    WrongConfig,
    #[msg("The supplied program-data account does not belong to this program.")]
    WrongProgramData,
    #[msg("A settlement token account has the wrong owner.")]
    WrongRecipient,
    #[msg("An authority cannot be the default public key.")]
    InvalidAuthority,
    #[msg("The proposed admin matches the current admin.")]
    AuthorityUnchanged,
    #[msg("There is no pending administrator transfer.")]
    NoPendingAdmin,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_release_conserves_value_and_rounds_fee_down() {
        let split = settlement_split(100_000_001, 100_000_001, 500).unwrap();
        assert_eq!(split.platform_fee_amount, 5_000_000);
        assert_eq!(split.worker_amount, 95_000_001);
        assert_eq!(split.client_refund_amount, 0);
        assert_eq!(
            split.worker_amount + split.client_refund_amount + split.platform_fee_amount,
            100_000_001
        );
    }

    #[test]
    fn partial_resolution_charges_fee_only_on_worker_gross() {
        let split = settlement_split(100_000_000, 60_000_000, 500).unwrap();
        assert_eq!(split.worker_amount, 57_000_000);
        assert_eq!(split.client_refund_amount, 40_000_000);
        assert_eq!(split.platform_fee_amount, 3_000_000);
    }

    #[test]
    fn full_refund_has_no_platform_fee() {
        let split = settlement_split(100_000_000, 0, 500).unwrap();
        assert_eq!(
            split,
            SettlementSplit {
                worker_amount: 0,
                client_refund_amount: 100_000_000,
                platform_fee_amount: 0,
            }
        );
    }

    #[test]
    fn rejects_an_overallocated_resolution() {
        assert!(settlement_split(100, 101, 500).is_err());
    }

    #[test]
    fn rejects_fee_above_the_program_cap() {
        assert!(settlement_split(100, 100, MAX_PROTOCOL_FEE_BPS + 1).is_err());
    }

    #[test]
    fn handles_maximum_u64_without_overflow() {
        let split = settlement_split(u64::MAX, u64::MAX, MAX_PROTOCOL_FEE_BPS).unwrap();
        assert_eq!(split.worker_amount + split.platform_fee_amount, u64::MAX);
    }
}
