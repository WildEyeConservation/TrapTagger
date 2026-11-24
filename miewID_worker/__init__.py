'''
MiewID GPU worker package.

Celery workers on the `miewid` queue run `miewid_prepare`: optional SAM mask +
detection-box crop + ScarceNet flank + MiewID embedding for individual-ID prep
(no WBIA). Masking defaults off (use_mask=False).
'''
