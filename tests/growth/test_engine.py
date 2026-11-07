import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('engine', Path(__file__).resolve().parents[2] / 'scripts/growth/engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / 'queue.sqlite3')
        self.call('add', '--url', 'https://example.org/submit', '--kind', 'editorial',
                  '--title', 'Relevant audience', '--evidence', 'https://example.org/rules',
                  '--relevance', '9', '--audience', '8', '--effort', '3')

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, *args):
        return engine.main(['--db', self.db, *args])

    def save_draft(self, text):
        file = Path(self.tmp.name) / 'draft.md'
        file.write_text(text)
        self.call('draft', '1', '--file', str(file))

    def test_edit_revokes_approval_and_blocks_submission(self):
        self.save_draft('First draft')
        self.call('approve', '1', '--by', 'Owner', '--evidence', 'Explicit approval')
        self.save_draft('Edited draft')
        with self.assertRaises(ValueError):
            self.call('record-submission', '1', '--evidence', 'https://example.org/receipt')

    def test_submission_and_placement_require_state(self):
        with self.assertRaises(ValueError):
            self.call('placement', '1', '--url', 'https://example.org/article')
        self.save_draft('Reviewed copy')
        self.call('approve', '1', '--by', 'Owner', '--evidence', 'Explicit approval')
        self.call('record-submission', '1', '--evidence', 'https://example.org/receipt')
        self.call('placement', '1', '--url', 'https://example.org/article')
        self.assertEqual(self.call('report')['opportunities'][0]['status'], 'placed')

    def test_revenue_deduplication_and_affiliate_stages(self):
        def event(ident, kind, cents):
            return self.call('event', '1', '--event-id', ident, '--kind', kind,
                             '--cents', str(cents), '--evidence', 'Provider record reference')
        event('charge:1', 'sale', 10000)
        self.assertTrue(event('charge:1', 'sale', 10000)['duplicate'])
        with self.assertRaises(ValueError):
            event('charge:1', 'sale', 20000)
        event('fee:1', 'fee', 300)
        event('tax:1', 'tax', 700)
        event('partner:1:pending', 'affiliate_pending', 2000)
        event('partner:1:approved', 'affiliate_approved', 2000)
        event('partner:1:paid', 'affiliate_paid', 2000)
        totals = self.call('report')['events_by_currency']['USD']
        self.assertEqual(totals['sale']['count'], 1)
        self.assertEqual(totals['direct_net_proceeds_cents'], 9000)
        self.assertEqual(totals['affiliate_net_approved_cents'], 2000)

    def test_tracking_preserves_parameters_and_rejects_partner_mutation(self):
        result = self.call('tracking', '--url', 'https://ypnus.com/?zip=93654',
                           '--source', 'podcast', '--medium', 'referral', '--campaign', 'launch')
        self.assertIn('zip=93654', result['url'])
        self.assertIn('utm_source=podcast', result['url'])
        with self.assertRaises(ValueError):
            self.call('tracking', '--url', 'https://partner.example/?tag=real',
                      '--source', 'x', '--medium', 'y', '--campaign', 'z')

    def test_invalid_urls_and_score(self):
        with self.assertRaises(ValueError):
            engine.url('javascript:alert(1)')
        with self.assertRaises(ValueError):
            engine.url('https://user:password@example.org/')
        self.assertEqual(self.call('report')['opportunities'][0]['priority_score'], 80)


if __name__ == '__main__':
    unittest.main()
